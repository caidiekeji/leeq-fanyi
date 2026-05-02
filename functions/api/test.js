export async function onRequest(context) {
  return new Response(JSON.stringify({ status: 'ok', message: 'Functions 工作正常' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
