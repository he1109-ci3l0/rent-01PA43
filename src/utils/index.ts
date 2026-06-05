export const formatCurrency = (amount: number, currency = 'MXN'): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(amount);

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const getDaysUntil = (dateString: string): number => {
  const target = new Date(dateString).getTime();
  const now = Date.now();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
};

export const isOverdue = (dateString: string): boolean => getDaysUntil(dateString) < 0;
