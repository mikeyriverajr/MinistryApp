export const formatTime = (timeStr: string | null | undefined, is12h: boolean): string => {
  if (!timeStr) return '';
  if (!is12h) return timeStr;

  const [hStr, mStr] = timeStr.split(':');
  if (!hStr || !mStr) return timeStr;

  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);

  if (isNaN(h) || isNaN(m)) return timeStr;

  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12; // the hour '0' should be '12'

  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
};

export const formatTimeFromDate = (d: Date, is12h: boolean): string => {
    return formatTime(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`, is12h);
};
