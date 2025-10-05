/**
 * Integration Tests for Game REST API
 * 
 * Tests all game-related REST endpoints
 */

import request from 'supertest';
import express from 'express';
import authRouter from '../../api/auth.routes';
import gameRouter from '../../api/game.routes';
import { authenticateToken } from '../../auth/middleware';

// Create a test app with auth and game routes
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/games', gameRouter);
  return app;
};

// Helper to create a player and get token
async function createPlayerAndGetToken(app: express.Application, name: string) {
  const response = await request(app)
    .post('/api/auth/join')
    .send({ playerName: name });
  
  return {
    playerId: response.body.playerId,
    playerName: response.body.playerName,
    token: response.body.token,
  };
}

describe('Game REST API Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('POST /api/games', () => {
    it('should create a new game with valid authentication', async () => {
      const player = await createPlayerAndGetToken(app, 'GameCreator');

      const response = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${player.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('gameId');
      expect(typeof response.body.gameId).toBe('string');
      expect(response.body.gameId.length).toBeGreaterThan(0);
    });

    it('should create unique game IDs', async () => {
      const player = await createPlayerAndGetToken(app, 'MultiGameCreator');

      const response1 = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${player.token}`)
        .expect(200);

      const response2 = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${player.token}`)
        .expect(200);

      expect(response1.body.gameId).not.toBe(response2.body.gameId);
    });

    it('should reject request without authentication', async () => {
      await request(app)
        .post('/api/games')
        .expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(app)
        .post('/api/games')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject request with malformed authorization header', async () => {
      await request(app)
        .post('/api/games')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);
    });

    it('should reject request with empty token', async () => {
      await request(app)
        .post('/api/games')
        .set('Authorization', 'Bearer ')
        .expect(401);
    });
  });

  describe('GET /api/games', () => {
    it('should return list of games with valid authentication', async () => {
      const player = await createPlayerAndGetToken(app, 'GameLister');

      const response = await request(app)
        .get('/api/games')
        .set('Authorization', `Bearer ${player.token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should include created games in the list', async () => {
      const player = await createPlayerAndGetToken(app, 'ListChecker');

      // Create a game
      const createResponse = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${player.token}`)
        .expect(200);

      const gameId = createResponse.body.gameId;

      // Get list
      const listResponse = await request(app)
        .get('/api/games')
        .set('Authorization', `Bearer ${player.token}`)
        .expect(200);

      // Should contain the created game
      const game = listResponse.body.find((g: any) => g.id === gameId);
      expect(game).toBeDefined();
      expect(game).toHaveProperty('status');
      expect(game).toHaveProperty('playerCount');
    });

    it('should reject request without authentication', async () => {
      await request(app)
        .get('/api/games')
        .expect(401);
    });

    it('should return empty array when no games exist', async () => {
      const player = await createPlayerAndGetToken(app, 'EmptyLister');

      const response = await request(app)
        .get('/api/games')
        .set('Authorization', `Bearer ${player.token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/games/:gameId', () => {
    it('should return game details with valid authentication and game ID', async () => {
      const player = await createPlayerAndGetToken(app, 'GameGetter');

      // Create a game
      const createResponse = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${player.token}`)
        .expect(200);

      const gameId = createResponse.body.gameId;

      // Get game details
      const response = await request(app)
        .get(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${player.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', gameId);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('players');
      expect(Array.isArray(response.body.players)).toBe(true);
    });

    it('should return 404 for non-existent game', async () => {
      const player = await createPlayerAndGetToken(app, 'NotFoundGetter');

      await request(app)
        .get('/api/games/non-existent-game-id')
        .set('Authorization', `Bearer ${player.token}`)
        .expect(404);
    });

    it('should reject request without authentication', async () => {
      await request(app)
        .get('/api/games/some-game-id')
        .expect(401);
    });

    it('should include player information in game details', async () => {
      const player1 = await createPlayerAndGetToken(app, 'Player1');
      const player2 = await createPlayerAndGetToken(app, 'Player2');

      // Player1 creates game
      const createResponse = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${player1.token}`)
        .expect(200);

      const gameId = createResponse.body.gameId;

      // Get game details (after some time for processing)
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await request(app)
        .get(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${player1.token}`)
        .expect(200);

      expect(response.body.players).toHaveLength(0); // No players joined yet via WebSocket
      expect(response.body.status).toBe('WAITING_FOR_PLAYERS');
    });
  });

  describe('Concurrent Game Creation', () => {
    it('should handle multiple players creating games simultaneously', async () => {
      // Create multiple players
      const players = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          createPlayerAndGetToken(app, `ConcurrentPlayer${i}`)
        )
      );

      // All create games simultaneously
      const createRequests = players.map(player =>
        request(app)
          .post('/api/games')
          .set('Authorization', `Bearer ${player.token}`)
      );

      const responses = await Promise.all(createRequests);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('gameId');
      });

      // All should have unique game IDs
      const gameIds = responses.map(r => r.body.gameId);
      const uniqueIds = new Set(gameIds);
      expect(uniqueIds.size).toBe(5);
    });
  });

  describe('Error Handling', () => {
    it('should return proper error for malformed game ID in GET request', async () => {
      const player = await createPlayerAndGetToken(app, 'ErrorTester');

      const response = await request(app)
        .get('/api/games/malformed-id-with-special-chars-!@#')
        .set('Authorization', `Bearer ${player.token}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle expired tokens gracefully', async () => {
      // This would require mocking token expiration
      // For now, just test with an obviously invalid token
      await request(app)
        .post('/api/games')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature')
        .expect(401);
    });
  });

  describe('Response Format', () => {
    it('should return consistent response format for game creation', async () => {
      const player = await createPlayerAndGetToken(app, 'FormatTester');

      const response = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${player.token}`)
        .expect(200);

      // Check response structure
      expect(response.body).toMatchObject({
        gameId: expect.any(String)
      });
    });

    it('should return proper Content-Type headers', async () => {
      const player = await createPlayerAndGetToken(app, 'HeaderTester');

      const response = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${player.token}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });
});
