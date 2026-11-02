import http from 'node:http';

const PORT = parseInt(process.env.MOCK_STRAPI_PORT || '1337', 10);
let strapiVersion = process.env.MOCK_STRAPI_VERSION || '5';

// Mock in-memory database by collection endpoint (e.g. 'service-pages', 'articles', etc.)
let nextId = 2;
const collectionsDb = new Map();
const uploadedFiles = [];

function getCollectionDb(collectionName) {
	if (!collectionsDb.has(collectionName)) {
		collectionsDb.set(collectionName, new Map());
	}
	return collectionsDb.get(collectionName);
}

// Pre-populate demo article with all schema fields
const initialArticlesDb = getCollectionDb('articles');
const demoArticle = {
	id: 1,
	documentId: 'doc-article-1',
	title: 'Sample Article: Artificial Intelligence in Modern Content Workflows',
	slug: 'sample-article-ai-content-workflows',
	summary: 'An introductory overview of AI-assisted document parsing and automated CMS ingestion.',
	body: '<p>This is a pre-populated article demonstrating the Strapi collection structure. It contains body copy, summary, and draft status.</p>',
	status: 'draft',
	authorName: 'DocuFlow Team',
	publishedAt: null,
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString()
};
initialArticlesDb.set('1', demoArticle);
initialArticlesDb.set('doc-article-1', demoArticle);

// Pre-populate demo service page
const initialServicePagesDb = getCollectionDb('service-pages');
const demoServicePage = {
	id: 1,
	documentId: 'doc-service-pages-1',
	title: 'Enterprise Cloud Architecture & DevOps',
	slug: 'enterprise-cloud-architecture',
	description: 'Scalable cloud infrastructure migration and high-availability operations.',
	publishedAt: null,
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString()
};
initialServicePagesDb.set('1', demoServicePage);
initialServicePagesDb.set('doc-service-pages-1', demoServicePage);

// Pre-populate some relation categories
const categories = [
	{ id: 1, documentId: 'cat-1', name: 'Cloud Architecture' },
	{ id: 2, documentId: 'cat-2', name: 'Cybersecurity' },
	{ id: 3, documentId: 'cat-3', name: 'Data & Analytics' },
	{ id: 4, documentId: 'cat-4', name: 'Enterprise AI' }
];

// Helper to parse JSON body
function parseBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		req.on('data', (c) => chunks.push(c));
		req.on('end', () => {
			const buf = Buffer.concat(chunks);
			if (buf.length === 0) return resolve({});
			const contentType = req.headers['content-type'] || '';
			if (contentType.includes('application/json')) {
				try {
					resolve(JSON.parse(buf.toString('utf8')));
				} catch (e) {
					reject(e);
				}
			} else {
				// Raw buffer for multipart upload
				resolve({ rawBuffer: buf, contentType });
			}
		});
		req.on('error', reject);
	});
}

function sendJson(res, statusCode, data) {
	res.writeHead(statusCode, {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
	});
	res.end(JSON.stringify(data));
}

function formatResponseItem(item, version) {
	if (version === '4') {
		const { id, documentId: _docId, ...attributes } = item;
		return {
			id,
			attributes
		};
	} else {
		// Strapi 5 flat attributes with id and documentId
		return {
			...item
		};
	}
}

export function startMockServer(port = PORT, version = strapiVersion) {
	strapiVersion = version;

	const server = http.createServer(async (req, res) => {
		const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
		const pathname = parsedUrl.pathname;
		const method = req.method;

		// CORS preflight
		if (method === 'OPTIONS') {
			res.writeHead(204, {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization',
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
			});
			return res.end();
		}

		// Auth check (allow admin or api token)
		const authHeader = req.headers['authorization'] || '';
		if (
			pathname.startsWith('/api/') &&
			!authHeader.includes('Bearer') &&
			!req.headers['x-bypass-auth']
		) {
			return sendJson(res, 401, {
				error: {
					name: 'UnauthorizedError',
					message: 'Missing or invalid credentials'
				}
			});
		}

		// Version switcher for tests
		if (pathname === '/mock/version' && method === 'POST') {
			const body = await parseBody(req);
			if (body.version === '4' || body.version === '5') {
				strapiVersion = body.version;
				return sendJson(res, 200, { ok: true, version: strapiVersion });
			}
		}

		// Mock Data overview endpoint
		if (pathname === '/mock/data') {
			const overview = {};
			for (const [colName, map] of collectionsDb.entries()) {
				overview[colName] = Array.from(map.values()).filter(
					(item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx
				);
			}
			return sendJson(res, 200, {
				version: strapiVersion,
				collections: overview,
				categories,
				uploads: uploadedFiles
			});
		}

		// DocuFlow live schema endpoint
		if (pathname === '/api/docuflow-schemas' || pathname === '/api/schemas') {
			try {
				const bundledPath = path.resolve('fixtures/schemas');
				const { contentTypes, components } = loadSchemasFromFiles(bundledPath);
				return sendJson(res, 200, {
					data: {
						contentTypes,
						components,
						version: strapiVersion
					}
				});
			} catch (err) {
				return sendJson(res, 500, { error: { message: String(err) } });
			}
		}

		// Web Dashboard for http://localhost:1337/ and http://localhost:1337/admin
		if (pathname === '/' || pathname === '/admin' || pathname === '/admin/') {
			const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mock Strapi CMS (v${strapiVersion})</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: #0f172a; color: #f8fafc; display: flex; height: 100vh; overflow: hidden; }
    aside { width: 280px; background-color: #1e293b; border-right: 1px solid #334155; display: flex; flex-direction: column; }
    .brand { padding: 20px; border-bottom: 1px solid #334155; display: flex; align-items: center; gap: 12px; }
    .brand-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; color: white; }
    .brand h1 { font-size: 16px; font-weight: 700; color: #f1f5f9; }
    .brand span { font-size: 11px; background: #3730a3; color: #c7d2fe; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
    .nav-section { padding: 16px 12px; flex: 1; overflow-y: auto; }
    .nav-title { font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 8px; padding-left: 8px; }
    .nav-btn { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: transparent; border: none; border-radius: 6px; color: #cbd5e1; cursor: pointer; text-align: left; font-size: 13px; font-weight: 500; margin-bottom: 4px; transition: all 0.15s; }
    .nav-btn:hover { background: #334155; color: white; }
    .nav-btn.active { background: #4f46e5; color: white; font-weight: 600; }
    .badge { font-size: 11px; background: rgba(255,255,255,0.15); padding: 2px 7px; border-radius: 10px; }
    main { flex: 1; display: flex; flex-direction: column; background-color: #0f172a; overflow-y: auto; }
    header { padding: 20px 28px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }
    header h2 { font-size: 20px; font-weight: 700; color: white; }
    .actions { display: flex; gap: 10px; }
    .btn { padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: background 0.15s; }
    .btn-primary { background: #4f46e5; color: white; }
    .btn-primary:hover { background: #4338ca; }
    .btn-secondary { background: #334155; color: #cbd5e1; }
    .btn-secondary:hover { background: #475569; color: white; }
    .content-area { padding: 28px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { padding: 12px 16px; background: #0f172a; color: #94a3b8; font-size: 12px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #334155; }
    td { padding: 14px 16px; border-bottom: 1px solid #334155; font-size: 13px; color: #e2e8f0; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255,255,255,0.02); }
    .status-draft { background: rgba(234, 179, 8, 0.15); color: #fde047; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .status-published { background: rgba(34, 197, 94, 0.15); color: #86efac; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .json-preview { margin-top: 20px; background: #020617; border: 1px solid #334155; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 12px; color: #38bdf8; max-height: 250px; overflow-y: auto; display: none; }
    .banner { margin-bottom: 20px; background: rgba(79, 70, 229, 0.12); border: 1px solid #4f46e5; border-radius: 8px; padding: 14px 18px; font-size: 13px; color: #c7d2fe; display: flex; justify-content: space-between; align-items: center; }
  </style>
</head>
<body>
  <aside>
    <div class="brand">
      <div class="brand-icon">S</div>
      <div>
        <h1>Mock Strapi CMS</h1>
        <span>v${strapiVersion} (Draft & Publish)</span>
      </div>
    </div>
    <div class="nav-section">
      <div class="nav-title">Collection Types</div>
      <button class="nav-btn active" onclick="switchCollection('articles')">
        <span>📰 Articles</span>
        <span class="badge" id="badge-articles">0</span>
      </button>
      <button class="nav-btn" onclick="switchCollection('service-pages')">
        <span>📄 Service Pages</span>
        <span class="badge" id="badge-service-pages">0</span>
      </button>
      <button class="nav-btn" onclick="switchCollection('categories')">
        <span>🏷️ Categories</span>
        <span class="badge" id="badge-categories">4</span>
      </button>
      <div class="nav-title" style="margin-top: 16px;">Plugins</div>
      <button class="nav-btn" onclick="switchCollection('upload')">
        <span>🖼️ Media Library</span>
        <span class="badge" id="badge-upload">0</span>
      </button>
    </div>
  </aside>

  <main>
    <header>
      <div>
        <h2 id="view-title">Articles</h2>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 4px;" id="endpoint-desc">REST Endpoint: /api/articles</p>
      </div>
      <div class="actions">
        <button class="btn btn-secondary" onclick="loadData()">↻ Refresh</button>
        <button class="btn btn-primary" onclick="createDemoEntry()">+ New Demo Entry</button>
      </div>
    </header>

    <div class="content-area">
      <div class="banner">
        <div>
          <strong>🟢 Mock Strapi Server is Active & Healthy</strong>
          <p style="margin-top: 2px; font-size: 12px; color: #cbd5e1;">Listening on <code>http://localhost:${port}</code>. DocuFlow connects directly to these endpoints.</p>
        </div>
        <a href="http://localhost:5173" target="_blank" style="color: #a5b4fc; text-decoration: none; font-weight: 600; font-size: 12px; background: #312e81; padding: 6px 12px; border-radius: 6px;">Open DocuFlow ↗</a>
      </div>

      <div class="card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Document ID</th>
              <th>Title / Name</th>
              <th>Slug / Target</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="entries-table">
            <tr><td colspan="6" style="text-align: center; color: #64748b;">Loading entries...</td></tr>
          </tbody>
        </table>
      </div>

      <div id="json-viewer" class="json-preview">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <strong style="color: #f1f5f9;">Selected Entry Payload:</strong>
          <button onclick="document.getElementById('json-viewer').style.display='none'" style="background:none; border:none; color:#94a3b8; cursor:pointer;">✕ Close</button>
        </div>
        <pre id="json-content"></pre>
      </div>
    </div>
  </main>

  <script>
    let currentCollection = 'articles';
    let dbData = null;

    async function loadData() {
      try {
        const res = await fetch('/mock/data');
        dbData = await res.json();
        
        // Update badges
        const articles = dbData.collections.articles || [];
        const sp = dbData.collections['service-pages'] || [];
        document.getElementById('badge-articles').textContent = articles.length;
        document.getElementById('badge-service-pages').textContent = sp.length;
        document.getElementById('badge-upload').textContent = (dbData.uploads || []).length;
        
        renderCollection();
      } catch (err) {
        console.error('Failed to load mock data', err);
      }
    }

    function switchCollection(name) {
      currentCollection = name;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      event.currentTarget.classList.add('active');
      document.getElementById('view-title').textContent = name.charAt(0).toUpperCase() + name.slice(1);
      document.getElementById('endpoint-desc').textContent = 'REST Endpoint: /api/' + name;
      renderCollection();
    }

    function renderCollection() {
      if (!dbData) return;
      const tbody = document.getElementById('entries-table');
      tbody.innerHTML = '';

      let items = [];
      if (currentCollection === 'categories') {
        items = dbData.categories || [];
      } else if (currentCollection === 'upload') {
        items = dbData.uploads || [];
      } else {
        items = dbData.collections[currentCollection] || [];
      }

      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 32px;">No entries yet in this collection. Import a DOCX from DocuFlow or click "+ New Demo Entry".</td></tr>';
        return;
      }

      items.forEach(item => {
        const tr = document.createElement('tr');
        const isDraft = item.publishedAt === null;
        const statusBadge = isDraft 
          ? '<span class="status-draft">Draft</span>' 
          : '<span class="status-published">Published</span>';

        tr.innerHTML = \`
          <td>\${item.id}</td>
          <td><code style="color: #94a3b8; font-size: 11px;">\${item.documentId || '-'}</code></td>
          <td><strong>\${item.title || item.name || 'Untitled'}</strong></td>
          <td><code style="color: #a5b4fc; font-size: 11px;">\${item.slug || '-'}</code></td>
          <td>\${statusBadge}</td>
          <td>
            <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="viewJson('\${item.documentId || item.id}')">View JSON</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });
    }

    function viewJson(docId) {
      const items = (currentCollection === 'categories') 
        ? dbData.categories 
        : (currentCollection === 'upload')
          ? dbData.uploads
          : dbData.collections[currentCollection] || [];
      const item = items.find(i => String(i.documentId) === String(docId) || String(i.id) === String(docId));
      if (!item) return;

      const viewer = document.getElementById('json-viewer');
      document.getElementById('json-content').textContent = JSON.stringify(item, null, 2);
      viewer.style.display = 'block';
    }

    async function createDemoEntry() {
      const title = prompt('Enter entry title for ' + currentCollection + ':', 'Demo ' + currentCollection + ' entry');
      if (!title) return;

      const payload = {
        data: {
          title: title,
          slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          summary: 'Created via Mock Strapi UI',
          body: '<p>Sample content created from the mock Strapi dashboard.</p>'
        }
      };

      await fetch('/api/' + currentCollection, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer mock-token' },
        body: JSON.stringify(payload)
      });

      await loadData();
    }

    loadData();
    setInterval(loadData, 3000); // Poll every 3 seconds for new imports
  </script>
</body>
</html>`;
			res.writeHead(200, { 'Content-Type': 'text/html' });
			return res.end(html);
		}

		// Admin endpoints
		if (pathname === '/admin/information') {
			return sendJson(res, 200, {
				data: {
					strapiVersion: strapiVersion === '4' ? '4.25.0' : '5.0.0',
					nodeVersion: process.version,
					environment: 'development'
				}
			});
		}

		if (pathname === '/admin/login' && method === 'POST') {
			return sendJson(res, 200, {
				data: { token: 'mock-admin-jwt-token' }
			});
		}

		// Media upload endpoint: /api/upload
		if (pathname === '/api/upload' && method === 'POST') {
			const fileId = uploadedFiles.length + 1;
			const fileObj = {
				id: fileId,
				documentId: `media-doc-${fileId}`,
				name: `uploaded-image-${fileId}.png`,
				url: `/uploads/uploaded-image-${fileId}.png`,
				mime: 'image/png',
				size: 1024
			};
			uploadedFiles.push(fileObj);
			return sendJson(res, 200, [fileObj]);
		}

		// Categories (relations): /api/categories
		if (pathname === '/api/categories') {
			const query = parsedUrl.searchParams.get('filters[name][$containsi]') || '';
			const filtered = query
				? categories.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
				: categories;

			return sendJson(res, 200, {
				data: filtered.map((c) => formatResponseItem(c, strapiVersion))
			});
		}

		// Generic Collection Handler: supports /api/:collection (e.g. /api/service-pages, /api/articles, etc.)
		const apiMatch = pathname.match(
			/^\/api\/([a-zA-Z0-9_-]+)(?:\/([^/]+))?(?:\/actions\/publish)?$/
		);
		if (apiMatch && apiMatch[1] !== 'upload') {
			const collection = apiMatch[1];
			const idOrDocId = apiMatch[2];
			const isPublishAction = pathname.endsWith('/actions/publish');
			const db = getCollectionDb(collection);

			// 1. Single entry update or publish: /api/:collection/:id
			if (idOrDocId) {
				const existing = db.get(idOrDocId);

				if (!existing) {
					return sendJson(res, 404, {
						error: {
							name: 'NotFoundError',
							message: `Entry ${idOrDocId} not found in ${collection}`
						}
					});
				}

				if (isPublishAction || parsedUrl.searchParams.get('status') === 'published') {
					existing.publishedAt = new Date().toISOString();
					return sendJson(res, 200, { data: formatResponseItem(existing, strapiVersion) });
				}

				if (method === 'PUT') {
					const body = await parseBody(req);
					Object.assign(existing, body.data || {});
					existing.updatedAt = new Date().toISOString();
					return sendJson(res, 200, { data: formatResponseItem(existing, strapiVersion) });
				}

				if (method === 'GET') {
					return sendJson(res, 200, { data: formatResponseItem(existing, strapiVersion) });
				}
			}

			// 2. Collection root: /api/:collection
			if (method === 'GET') {
				const filterSlug = parsedUrl.searchParams.get('filters[slug][$eq]');
				const filterTitle = parsedUrl.searchParams.get('filters[title][$eq]');
				let results = Array.from(db.values()).filter(
					(item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx
				);

				if (filterSlug) {
					results = results.filter((i) => i.slug === filterSlug);
				}
				if (filterTitle) {
					results = results.filter((i) => i.title === filterTitle);
				}

				return sendJson(res, 200, {
					data: results.map((item) => formatResponseItem(item, strapiVersion))
				});
			}

			if (method === 'POST') {
				const body = await parseBody(req);
				const data = body.data || {};

				if (!data.title && !data.name) {
					return sendJson(res, 400, {
						error: {
							name: 'ValidationError',
							message: 'Validation error: title is required',
							details: {
								errors: [{ path: ['title'], message: 'title is a required field' }]
							}
						}
					});
				}

				const id = nextId++;
				const documentId = `doc-${collection}-${id}`;
				const isDraft =
					strapiVersion === '4'
						? data.publishedAt === null
						: parsedUrl.searchParams.get('status') === 'draft';

				const newEntry = {
					id,
					documentId,
					...data,
					publishedAt: isDraft ? null : new Date().toISOString(),
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				};

				db.set(String(id), newEntry);
				db.set(documentId, newEntry);

				return sendJson(res, 201, {
					data: formatResponseItem(newEntry, strapiVersion)
				});
			}
		}

		// Fallback 404
		return sendJson(res, 404, { error: { message: `Route ${pathname} not found` } });
	});

	return new Promise((resolve) => {
		server.listen(port, () => {
			console.log(`[Mock Strapi] Server listening on port ${port} (Strapi v${strapiVersion} mode)`);
			resolve(server);
		});
	});
}

// Standalone execution
if (process.argv[1] && process.argv[1].endsWith('mock-strapi.js')) {
	startMockServer();
}
