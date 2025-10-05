# Performance & Load Testing

Comprehensive performance tests for the Buck Euchre backend system.

## Test Files

### `concurrent-games.test.ts`
Tests system's ability to handle multiple concurrent games.

**Tests:**
- 20 concurrent games with 4 players each (80 total connections)
- Rapid game creation (10 games simultaneously)
- Sustained load test (3 rounds of player creation)

**Metrics:**
- Total time to create all players and games
- Average time per player/game
- Connection success rate
- Performance degradation over time

**Target:** Complete 20 concurrent games within 60 seconds

### `websocket-latency.test.ts`
Measures WebSocket message round-trip latency.

**Tests:**
- Round-trip latency for JOIN_GAME event (100 measurements)
- Latency under concurrent load (50 simultaneous requests)
- Connection establishment time (50 connections)

**Metrics:**
- Mean, median, min, max latency
- P95 and P99 percentiles
- Standard deviation
- Percentage of requests under target latency

**Target:** <100ms mean latency, 80%+ requests under 100ms

### `memory-leak.test.ts`
Detects memory leaks in long-running connections.

**Tests:**
- Repeated connections (100 connect/disconnect cycles)
- Connection churn (10 cycles of 20 connections each)
- Event listener cleanup

**Metrics:**
- Heap memory usage over time
- Memory growth percentage
- Event listener counts

**Target:** <50% memory growth across test duration

## Running Performance Tests

### Prerequisites

Backend server must be running:
```bash
cd backend
npm run dev
```

### Run All Performance Tests

```bash
# Run all performance tests
npm test -- src/__tests__/performance

# Run specific test file
npm test -- src/__tests__/performance/concurrent-games.test.ts

# Run with verbose output
npm test -- src/__tests__/performance --verbose
```

### Individual Test Suites

```bash
# Concurrent games test
npm test -- concurrent-games.test

# Latency test
npm test -- websocket-latency.test

# Memory leak test
npm test -- memory-leak.test
```

## Performance Targets

### Latency
- ✅ Mean latency: <100ms
- ✅ P95 latency: <150ms
- ✅ P99 latency: <200ms
- ✅ 80%+ requests under 100ms

### Throughput
- ✅ Handle 20+ concurrent games
- ✅ Support 80+ simultaneous connections
- ✅ Create 10+ games simultaneously

### Stability
- ✅ <50% memory growth over time
- ✅ 90%+ success rate under load
- ✅ <50% performance degradation

### Connection
- ✅ Connection establishment: <1s average
- ✅ Connection establishment P95: <2s

## Interpreting Results

### Good Performance
```
Mean latency: 45ms
P95 latency: 78ms
Memory growth: 15%
Success rate: 98%
```

### Acceptable Performance
```
Mean latency: 85ms
P95 latency: 130ms
Memory growth: 35%
Success rate: 92%
```

### Poor Performance (Needs Investigation)
```
Mean latency: 150ms
P95 latency: 250ms
Memory growth: 60%
Success rate: 85%
```

## Troubleshooting

### High Latency
- Check database connection pool settings
- Verify network conditions
- Check for blocking operations in event handlers
- Profile server-side code

### Memory Leaks
- Run with `--expose-gc` to enable garbage collection
- Check for unclosed database connections
- Verify event listeners are properly cleaned up
- Look for circular references

### Failed Connections
- Check server capacity (max connections)
- Verify WebSocket configuration
- Check for firewall/proxy issues
- Review server logs for errors

## Environment Variables

```bash
# Backend URL (default: http://localhost:3000)
BACKEND_URL=http://localhost:3000

# Enable garbage collection for memory tests
NODE_OPTIONS="--expose-gc"
```

## CI/CD Integration

```bash
# Start backend
npm run dev &
BACKEND_PID=$!

# Wait for server
sleep 5

# Run performance tests
npm test -- src/__tests__/performance --run

# Cleanup
kill $BACKEND_PID
```

## Monitoring in Production

For production monitoring, consider:
- Application Performance Monitoring (APM) tools
- Real-time latency tracking
- Memory profiling
- Connection pool monitoring
- Database query performance
- WebSocket message rates

## Recommended Tools

- **Load Testing:** Artillery, k6
- **Profiling:** Node.js built-in profiler, clinic.js
- **Monitoring:** PM2, New Relic, DataDog
- **Memory Analysis:** heapdump, Chrome DevTools

## Performance Optimization Tips

1. **Database:** Use connection pooling, optimize queries
2. **WebSocket:** Batch state updates, compress messages
3. **Memory:** Clean up listeners, avoid circular references
4. **Caching:** Cache frequently accessed data
5. **Concurrency:** Use worker threads for CPU-intensive tasks

## Benchmarking

To establish baseline performance:
1. Run tests 3-5 times
2. Record average metrics
3. Document system specifications
4. Save results for comparison

## Next Steps

- Monitor production metrics
- Set up alerting for performance degradation
- Regular performance regression testing
- Load test with expected production traffic
