async function request(path, { method = 'GET', body, form, signal } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    signal,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || 'The server could not be reached. Check that it is running.');
    error.status = res.status;
    error.code = data.code;
    throw error;
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body = {}) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  upload: (path, form, options = {}) => request(path, { method: 'POST', form, ...options }),
};

export const longDate = (date) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
export const shortDate = (date) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const num = (n) => Math.round(n).toLocaleString('en-IN');
