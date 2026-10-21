export const isHttp = (u: URL): boolean => u.protocol === 'http:' || u.protocol === 'https:';
