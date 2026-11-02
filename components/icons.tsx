// Ilova uchun yagona ikon to'plami: 20×20, chiziq qalinligi 1.6
type P = { className?: string };

const S = ({ children, className }: P & { children: React.ReactNode }) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={"icon " + (className ?? "")}>
    {children}
  </svg>
);

export const IconBoard = (p: P) => <S {...p}><circle cx="10" cy="10" r="7" /><path d="M10 6v4l2.6 1.6" /></S>;
export const IconUsers = (p: P) => <S {...p}><circle cx="7.5" cy="7" r="2.8" /><path d="M2.5 16c.6-2.6 2.6-4 5-4s4.4 1.4 5 4" /><path d="M13 4.6a2.6 2.6 0 0 1 0 4.8M14.6 12.2c1.5.5 2.5 1.8 2.9 3.8" /></S>;
export const IconSend = (p: P) => <S {...p}><path d="M17 3 8.6 11.4M17 3l-5.2 14-3.2-5.6L3 8.2 17 3Z" /></S>;
export const IconSearch = (p: P) => <S {...p}><circle cx="9" cy="9" r="5.5" /><path d="m13.2 13.2 3.3 3.3" /></S>;
export const IconRefresh = (p: P) => <S {...p}><path d="M16 10a6 6 0 1 1-1.8-4.3M16 3.5v3.3h-3.3" /></S>;
export const IconLogout = (p: P) => <S {...p}><path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M12.5 13.5 16 10l-3.5-3.5M16 10H8" /></S>;
export const IconDoor = (p: P) => <S {...p}><path d="M5 17V4.5a1 1 0 0 1 .8-1l7-1.3a1 1 0 0 1 1.2 1V17M3 17h14" /><path d="M11 10.5v.5" /></S>;
export const IconGroup = (p: P) => <S {...p}><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M3 8h14M7 12h3" /></S>;
export const IconBack = (p: P) => <S {...p}><path d="M12 4.5 6.5 10l5.5 5.5" /></S>;
export const IconChevron = (p: P) => <S {...p}><path d="m8 5 5 5-5 5" /></S>;
export const IconLink = (p: P) => <S {...p}><path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.9.9M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l.9-.9" /></S>;
export const IconCopy = (p: P) => <S {...p}><rect x="7" y="7" width="9.5" height="9.5" rx="2" /><path d="M13 7V5a1.5 1.5 0 0 0-1.5-1.5h-6A1.5 1.5 0 0 0 4 5v6.5A1.5 1.5 0 0 0 5.5 13H7" /></S>;
export const IconCheck = (p: P) => <S {...p}><path d="m4.5 10.5 3.5 3.5 7.5-8" /></S>;
export const IconClose = (p: P) => <S {...p}><path d="m5 5 10 10M15 5 5 15" /></S>;
export const IconCalendar = (p: P) => <S {...p}><rect x="3" y="4" width="14" height="13" rx="2" /><path d="M3 8h14M7 2.5V5M13 2.5V5" /></S>;
export const IconBolt = (p: P) => <S {...p}><path d="M11 2.5 4.5 11H10l-1 6.5L15.5 9H10l1-6.5Z" /></S>;
