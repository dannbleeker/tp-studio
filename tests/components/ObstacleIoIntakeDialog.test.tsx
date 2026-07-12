import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ObstacleIoIntakeDialog } from '@/components/prt/ObstacleIoIntakeDialog';
import { resetStoreForTest, useDocumentStore } from '@/store';

beforeEach(resetStoreForTest);
afterEach(cleanup);

const s = () => useDocumentStore.getState();
const byType = (t: string) => Object.values(s().doc.entities).filter((e) => e.type === t);

describe('ObstacleIoIntakeDialog (E)', () => {
  it('renders nothing until the store flag is set', () => {
    const { container } = render(<ObstacleIoIntakeDialog />);
    expect(container.firstChild).toBeNull();
  });

  it('adds rows, and Apply mints the pairs and closes', () => {
    s().newDocument('prt');
    s().openObstacleIoIntake();
    render(<ObstacleIoIntakeDialog />);
    expect(screen.getByText('Add obstacles & objectives')).toBeTruthy();

    // Apply is disabled with an all-blank table.
    const applyBtn = screen.getByRole('button', { name: /Apply/ }) as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(true);

    // Add a second row, fill the first.
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
    fireEvent.change(screen.getByLabelText('Obstacle 1'), { target: { value: 'No owner' } });
    fireEvent.change(screen.getByLabelText('Objective 1'), {
      target: { value: 'An owner exists' },
    });
    expect(applyBtn.disabled).toBe(false);

    fireEvent.click(applyBtn);
    // One pair minted, dialog closed.
    expect(byType('obstacle')).toHaveLength(1);
    expect(byType('intermediateObjective')).toHaveLength(1);
    expect(s().obstacleIoIntakeOpen).toBe(false);
  });

  it('removes a row via its trash button', () => {
    s().newDocument('prt');
    s().openObstacleIoIntake();
    render(<ObstacleIoIntakeDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
    // 3 rows → 3 obstacle inputs.
    expect(screen.getAllByLabelText(/^Obstacle \d/)).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Remove row 2' }));
    expect(screen.getAllByLabelText(/^Obstacle \d/)).toHaveLength(2);
  });
});
