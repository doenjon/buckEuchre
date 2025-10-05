# Frontend Component Tests

Comprehensive unit tests for React components using Vitest and React Testing Library.

## Test Coverage

### Card Component Tests (`Card.test.tsx`)
- **Rendering**: Correct rank/suit display, face down cards, size variants
- **Interactions**: Click handlers, disabled state, keyboard accessibility
- **Selected State**: Visual highlighting, aria-pressed attribute
- **Disabled State**: Opacity, cursor styles, click prevention
- **Face Down Cards**: Alternative rendering, click handling
- **Accessibility**: ARIA labels, keyboard navigation, focus styles
- **Suit Colors**: Correct colors for red/black suits
- **Edge Cases**: Rapid clicks, re-renders, missing onClick

### PlayerHand Component Tests (`PlayerHand.test.tsx`)
- **Rendering**: All cards displayed, empty state, card count
- **Interactions**: Card click callbacks, disabled state
- **Selected State**: Highlighting, state updates
- **Disabled State**: All cards disabled, no interactions
- **Accessibility**: Group role, aria-labels, keyboard navigation
- **Edge Cases**: Single card, maximum cards, rapid clicks, state persistence

### Scoreboard Component Tests (`Scoreboard.test.tsx`)
- **Rendering**: All players, names, scores, tricks, game phase
- **Current Player**: Turn highlighting, visual feedback
- **Trump Suit**: Symbol display, dynamic updates
- **Bidder Indication**: Badge display, bid amount
- **Player Status**: Offline badges, folded badges, opacity
- **Win Condition**: Winner display, score highlighting
- **Accessibility**: List roles, descriptive labels, screen reader support
- **Edge Cases**: Empty names, null values, phase formatting
- **Dynamic Updates**: Score changes, phase transitions, trump declaration

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-reruns on file changes)
npm test

# Run tests with UI
npm test:ui

# Run tests with coverage report
npm test:coverage

# Run specific test file
npm test Card.test

# Run tests matching pattern
npm test -- PlayerHand
```

## Test Framework

- **Test Runner:** Vitest
- **UI Testing:** React Testing Library
- **User Interactions:** @testing-library/user-event
- **Assertions:** @testing-library/jest-dom
- **Environment:** jsdom (simulates browser)

## Writing Tests

### Test Structure

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('Component Name', () => {
  describe('Feature Category', () => {
    it('should do something specific', async () => {
      // Arrange
      render(<Component prop="value" />);
      
      // Act
      await userEvent.click(screen.getByRole('button'));
      
      // Assert
      expect(screen.getByText('Result')).toBeInTheDocument();
    });
  });
});
```

### Best Practices

1. **Use semantic queries**: Prefer `getByRole`, `getByLabelText` over `getByTestId`
2. **Test user behavior**: Focus on what users see and do, not implementation
3. **Descriptive test names**: Use "should" statements that describe expected behavior
4. **Arrange-Act-Assert**: Organize tests clearly
5. **Async interactions**: Use `await` with `userEvent` methods
6. **Accessibility**: Test ARIA attributes and keyboard navigation
7. **Edge cases**: Test boundary conditions and error states

### Query Priority (React Testing Library)

1. `getByRole` - Most accessible, best option
2. `getByLabelText` - Good for form elements
3. `getByPlaceholderText` - For inputs
4. `getByText` - For non-interactive elements
5. `getByDisplayValue` - For form inputs with values
6. `getByAltText` - For images
7. `getByTitle` - For elements with title attribute
8. `getByTestId` - Last resort, avoid when possible

## Coverage Goals

- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

## Debugging Tests

### View Test UI
```bash
npm test:ui
```
Opens a browser with interactive test viewer.

### Console Logging
```typescript
import { screen } from '@testing-library/react';

screen.debug(); // Prints current DOM
screen.logTestingPlaygroundURL(); // Opens Testing Playground
```

### VSCode Integration
Install "Vitest" extension for inline test running and debugging.

## Common Patterns

### Testing Click Events
```typescript
const handleClick = vi.fn();
render(<Button onClick={handleClick} />);
await userEvent.click(screen.getByRole('button'));
expect(handleClick).toHaveBeenCalledTimes(1);
```

### Testing Async State
```typescript
render(<Component />);
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```

### Testing Accessibility
```typescript
const button = screen.getByRole('button', { name: /submit/i });
expect(button).toHaveAttribute('aria-label', 'Submit form');
expect(button).toHaveFocus();
```

### Testing Conditional Rendering
```typescript
const { rerender } = render(<Component show={false} />);
expect(screen.queryByText('Content')).not.toBeInTheDocument();

rerender(<Component show={true} />);
expect(screen.getByText('Content')).toBeInTheDocument();
```

## Troubleshooting

### Tests Timeout
- Increase timeout in test: `it('test', async () => {}, 10000)`
- Check for unresolved promises
- Ensure all async operations use `await`

### Element Not Found
- Use `screen.debug()` to see current DOM
- Check if element is rendered conditionally
- Use `findBy` queries for async elements
- Verify query matches actual rendered text/role

### Act Warnings
- Wrap state updates in `act()` or use `waitFor()`
- Use `await` with `userEvent` methods
- Ensure all async operations complete

## CI/CD Integration

Tests run automatically on:
- Pre-commit hooks
- Pull request checks
- CI/CD pipelines

```bash
# CI command
npm test -- --run --reporter=verbose
```

## Next Steps

To add more component tests:
1. Create new test file: `ComponentName.test.tsx`
2. Follow existing patterns from Card/PlayerHand/Scoreboard tests
3. Cover all user interactions and visual states
4. Test accessibility features
5. Include edge cases
6. Run coverage to identify gaps

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
- [jest-dom Matchers](https://github.com/testing-library/jest-dom)
- [Common Testing Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
