/**
 * Safe fetch wrapper that handles non-JSON responses (e.g. HTML error pages)
 * and always throws descriptive errors.
 */
export async function fetchJson(input: RequestInfo, init?: RequestInit): Promise<any> {
  const res = await fetch(input, init);
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  } catch (err) {
    if (err instanceof SyntaxError) {
      if (text.startsWith("<!DOCTYPE")) {
        throw new Error(
          "The server returned an HTML page instead of JSON. " +
          "This usually means the backend is not running or is unreachable."
        );
      }
      throw new Error(text.slice(0, 300) || `Server returned invalid response (status ${res.status})`);
    }
    throw err;
  }
}
