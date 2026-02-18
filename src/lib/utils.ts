export function formatPrice(amount: number | undefined | null): string {
    if (amount === undefined || amount === null) return '0.00';
    return Number(amount).toLocaleString('en-PK', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}
