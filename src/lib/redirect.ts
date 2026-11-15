// Same-origin redirect with a relative Location header.
//
// Behind a hosting proxy (Render, for example) the server sees its internal
// address in request.url, e.g. https://localhost:10000. Building an absolute
// redirect from request.url therefore sends the browser to that internal
// address. A relative Location is resolved by the browser against the public
// address it actually used, so it is correct on every host.
export function redirectTo(path: `/${string}`): Response {
  // 303: the browser follows with GET, also after a POST (sign-out form).
  return new Response(null, { status: 303, headers: { Location: path } });
}
