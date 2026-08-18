import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';

const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

/** Ce qui gagne à être compressé : le reste (images, archives) l'est déjà. */
const COMPRESSIBLE = /^(?:text\/|application\/(?:json|javascript|xml)|image\/svg)/;

/** En dessous, l'en-tête coûte plus cher que ce qu'on économise. */
const MIN_BYTES = 1024;

/**
 * Qualité 4 : la compression d'une page se compte en millisecondes et le
 * gain sur les derniers crans ne vaut pas le temps processeur.
 */
const BROTLI_QUALITY = 4;

/**
 * Compresse une réponse quand le navigateur l'accepte. L'application est
 * servie telle quelle par le conteneur, sans proxy devant pour s'en charger :
 * sans ça, une liste de bibliothèque part en quelques centaines de kilooctets
 * de HTML, ce qui se voit surtout sur un téléphone en 4G.
 */
export async function compressResponse(response: Response, acceptEncoding: string): Promise<Response> {
	const type = response.headers.get('content-type') ?? '';
	if (
		!response.body ||
		response.headers.has('content-encoding') ||
		!COMPRESSIBLE.test(type) ||
		type.startsWith('text/event-stream')
	) {
		return response;
	}

	const accepted = acceptEncoding.toLowerCase();
	const encoding = accepted.includes('br') ? 'br' : accepted.includes('gzip') ? 'gzip' : null;
	if (!encoding) return response;

	const body = Buffer.from(await response.arrayBuffer());
	if (body.length < MIN_BYTES) {
		// Le corps a été consommé : il faut reconstruire la réponse à l'identique.
		return new Response(new Uint8Array(body), {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers
		});
	}

	const compressed =
		encoding === 'br'
			? await brotli(body, { params: { [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY } })
			: await gzipAsync(body);
	const headers = new Headers(response.headers);
	headers.set('Content-Encoding', encoding);
	headers.set('Content-Length', String(compressed.length));
	headers.append('Vary', 'Accept-Encoding');
	return new Response(new Uint8Array(compressed), {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}
