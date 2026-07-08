(function () {
  var script = document.currentScript;
  if (!script) return;

  var publicKey = script.getAttribute('data-ai-support-public-key');
  if (!publicKey) return;

  var apiBase = script.getAttribute('data-ai-support-api-base') || '';
  var rootId = 'ai-support-widget-' + publicKey;
  if (document.getElementById(rootId)) return;

  function request(path, body) {
    return fetch(apiBase + path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'omit',
    }).then(function (res) {
      return res.json();
    }).then(function (json) {
      if (json.code !== 0) throw new Error(json.message || 'Request failed');
      return json.data;
    });
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === 'className') node.className = attrs[key];
      else if (key === 'text') node.textContent = attrs[key];
      else if (key.indexOf('on') === 0) node.addEventListener(key.slice(2).toLowerCase(), attrs[key]);
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) {
      node.appendChild(child);
    });
    return node;
  }

  function injectStyles() {
    if (document.getElementById('ai-support-widget-style')) return;
    var style = el('style', { id: 'ai-support-widget-style' });
    style.textContent = [
      '.ai-support-root{position:fixed;right:20px;bottom:20px;z-index:2147483000;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827}',
      '.ai-support-button{width:56px;height:56px;border:0;border-radius:999px;background:#2563eb;color:white;box-shadow:0 16px 40px rgba(37,99,235,.35);cursor:pointer;font-weight:700}',
      '.ai-support-panel{position:absolute;right:0;bottom:72px;width:min(360px,calc(100vw - 32px));border:1px solid #e5e7eb;border-radius:16px;background:white;box-shadow:0 24px 70px rgba(15,23,42,.18);overflow:hidden}',
      '.ai-support-header{padding:16px;border-bottom:1px solid #eef2f7;background:#f8fafc}',
      '.ai-support-title{margin:0;font-size:15px;font-weight:700}',
      '.ai-support-desc{margin:6px 0 0;color:#64748b;font-size:13px;line-height:1.4}',
      '.ai-support-body{padding:14px;display:grid;gap:10px}',
      '.ai-support-input,.ai-support-textarea{box-sizing:border-box;width:100%;border:1px solid #d1d5db;border-radius:10px;padding:10px 11px;font:inherit;font-size:13px}',
      '.ai-support-textarea{min-height:84px;resize:vertical}',
      '.ai-support-submit{border:0;border-radius:10px;background:#111827;color:white;padding:10px 12px;font-weight:700;cursor:pointer}',
      '.ai-support-secondary{border:1px solid #d1d5db;border-radius:10px;background:white;color:#111827;padding:10px 12px;font-weight:700;cursor:pointer}',
      '.ai-support-status{font-size:12px;line-height:1.4;color:#64748b;min-height:18px}',
      '.ai-support-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    ].join('');
    document.head.appendChild(style);
  }

  function render(config) {
    injectStyles();

    var root = el('div', { id: rootId, className: 'ai-support-root' });
    var panel = el('div', { className: 'ai-support-panel', hidden: 'true' });
    var status = el('div', { className: 'ai-support-status' });
    var name = el('input', { className: 'ai-support-input', placeholder: 'Name' });
    var email = el('input', { className: 'ai-support-input', placeholder: 'Email', type: 'email' });
    var message = el('textarea', { className: 'ai-support-textarea', placeholder: 'How can we help?' });

    function setStatus(text) {
      status.textContent = text;
    }

    function leadPayload() {
      return {
        name: name.value,
        email: email.value,
        sourceUrl: window.location.href,
        metadata: { widget: 'ai-support-widget' },
      };
    }

    panel.appendChild(el('div', { className: 'ai-support-header' }, [
      el('p', { className: 'ai-support-title', text: config.name || 'AI Support' }),
      el('p', {
        className: 'ai-support-desc',
        text: config.description || 'Leave your contact details and we will help from here.',
      }),
    ]));
    panel.appendChild(el('div', { className: 'ai-support-body' }, [
      name,
      email,
      message,
      el('div', { className: 'ai-support-actions' }, [
        el('button', {
          className: 'ai-support-submit',
          type: 'button',
          text: 'Send',
          onClick: function () {
            setStatus('Sending...');
            request('/api/ai-support/widget/' + publicKey + '/leads', leadPayload())
              .then(function () {
                setStatus('Thanks. We received your request.');
              })
              .catch(function (error) {
                setStatus(error.message);
              });
          },
        }),
        el('button', {
          className: 'ai-support-secondary',
          type: 'button',
          text: 'Human',
          onClick: function () {
            setStatus('Escalating...');
            request('/api/ai-support/widget/' + publicKey + '/escalations', {
              summary: message.value,
              metadata: {
                name: name.value,
                email: email.value,
                sourceUrl: window.location.href,
                widget: 'ai-support-widget',
              },
            })
              .then(function () {
                setStatus('A human support request was created.');
              })
              .catch(function (error) {
                setStatus(error.message);
              });
          },
        }),
      ]),
      status,
    ]));

    var button = el('button', {
      className: 'ai-support-button',
      type: 'button',
      text: '?',
      onClick: function () {
        panel.hidden = !panel.hidden;
      },
    });

    root.appendChild(panel);
    root.appendChild(button);
    document.body.appendChild(root);
  }

  request('/api/ai-support/widget/' + publicKey)
    .then(render)
    .catch(function () {
      // Keep third-party pages quiet if the widget is not active yet.
    });
})();
