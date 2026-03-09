import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Net Worth Tracker header', () => {
  render(<App />);
  const heading = screen.getByText(/Net Worth Tracker/i);
  expect(heading).toBeInTheDocument();
});

test('renders navigation tabs', () => {
  render(<App />);
  expect(screen.getByRole('button', { name: /Dashboard/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Ledger/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Retirement/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Budget/i })).toBeInTheDocument();
});
