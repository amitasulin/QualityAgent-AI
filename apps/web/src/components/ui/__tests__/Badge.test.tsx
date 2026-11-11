import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge, PriorityBadge, SeverityBadge, StatusBadge } from '@/components/ui/Badge';

describe('Badge', () => {
  it('renders children with the default secondary variant', () => {
    render(<Badge>ברירת מחדל</Badge>);
    const badge = screen.getByText('ברירת מחדל');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-secondary-100', 'text-secondary-600', 'rounded-full');
  });

  it('applies the requested variant and size', () => {
    render(
      <Badge variant="success" size="sm">
        מאושר
      </Badge>
    );
    const badge = screen.getByText('מאושר');
    expect(badge).toHaveClass('bg-success-50', 'text-success-600', 'px-2', 'py-0.5');
  });

  it('merges a custom className', () => {
    render(<Badge className="shrink-0">מותאם</Badge>);
    expect(screen.getByText('מותאם')).toHaveClass('shrink-0');
  });
});

describe('StatusBadge', () => {
  it('translates NCR statuses', () => {
    render(<StatusBadge status="closed" type="ncr" />);
    const badge = screen.getByText('סגור');
    expect(badge).toHaveClass('bg-success-50');
  });

  it('translates complaint statuses', () => {
    render(<StatusBadge status="under_review" type="complaint" />);
    expect(screen.getByText('בבדיקה')).toHaveClass('bg-primary-100');
  });

  it('falls back to the raw status when unknown', () => {
    render(<StatusBadge status="mystery" type="task" />);
    expect(screen.getByText('mystery')).toBeInTheDocument();
  });
});

describe('SeverityBadge', () => {
  it('maps severity to a Hebrew label and tone', () => {
    render(<SeverityBadge severity="critical" />);
    const badge = screen.getByText('קריטי');
    expect(badge).toHaveClass('bg-danger-50', 'text-danger-600');
  });

  it('falls back for unknown severities', () => {
    render(<SeverityBadge severity="unknown" />);
    expect(screen.getByText('unknown')).toBeInTheDocument();
  });
});

describe('PriorityBadge', () => {
  it('maps priority to a Hebrew label and tone', () => {
    render(<PriorityBadge priority="high" />);
    const badge = screen.getByText('גבוה');
    expect(badge).toHaveClass('bg-danger-50');
  });
});
