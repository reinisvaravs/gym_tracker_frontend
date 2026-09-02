// Tiny inline icon set (lucide outlines) so no icon dependency is needed.
// Buttons auto-size any svg inside them; pass className to size elsewhere.

function icon(children: React.ReactNode) {
  return function Icon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        {...props}
      >
        {children}
      </svg>
    );
  };
}

export const PlusIcon = icon(
  <>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </>,
);

export const MinusIcon = icon(<path d="M5 12h14" />);

export const XIcon = icon(
  <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>,
);

export const PencilIcon = icon(
  <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />,
);

export const TrashIcon = icon(
  <>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" x2="10" y1="11" y2="17" />
    <line x1="14" x2="14" y1="11" y2="17" />
  </>,
);

export const CheckIcon = icon(<path d="M20 6 9 17l-5-5" />);

export const FilterIcon = icon(
  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
);

export const ChevronLeftIcon = icon(<path d="m15 18-6-6 6-6" />);

export const ChevronRightIcon = icon(<path d="m9 18 6-6-6-6" />);

export const ChevronUpIcon = icon(<path d="m18 15-6-6-6 6" />);

export const ChevronDownIcon = icon(<path d="m6 9 6 6 6-6" />);

export const ListIcon = icon(
  <>
    <line x1="8" x2="21" y1="6" y2="6" />
    <line x1="8" x2="21" y1="12" y2="12" />
    <line x1="8" x2="21" y1="18" y2="18" />
    <line x1="3" x2="3.01" y1="6" y2="6" />
    <line x1="3" x2="3.01" y1="12" y2="12" />
    <line x1="3" x2="3.01" y1="18" y2="18" />
  </>,
);

export const CalendarIcon = icon(
  <>
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </>,
);
