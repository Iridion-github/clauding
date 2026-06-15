import { render, screen } from '@testing-library/react';
import { FlippingHusksCard } from './FlippingHusksCard';

// A leaf presentational component — no router/socket — so it loads cleanly in CRA's Jest.
test('a number card renders its value and word', () => {
  render(<FlippingHusksCard card={{ id: 'c1', type: 'number', value: 5 }} />);
  expect(screen.getAllByText('5').length).toBeGreaterThan(0); // outline + face spans
  expect(screen.getByText('FIVE')).toBeInTheDocument();
});
