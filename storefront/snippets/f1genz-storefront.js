(() => {
  if (window.__f1genzappReviewStorefrontRuntimeBooted) return;
  window.__f1genzappReviewStorefrontRuntimeBooted = true;
  const API_URL = 'https://api-haravan-reviews.f1genz.dev';
  const ACCOUNT_LOGIN_URL = '/account';

  const DEFAULT_CONFIG = {
    titleText: 'Đánh giá sản phẩm',
    accentColor: '#f59e0b',
    starColor: '#f59e0b',
    starBgColor: '#b3bcc5',
    starIconUrl: '',
    textColor: '#1a1a1a',
    mutedColor: '#6b7280',
    bgColor: '#ffffff',
    bgAltColor: '#f8fafc',
    borderColor: '#e5e7eb',
    verifiedColor: '#01ab56',
    radius: 12,
    showTitle: true,
    showDate: true,
    showFilter: true,
    showSort: true,
    emailDisplay: 'mask',
    phoneDisplay: 'mask',
    formEmailMode: 'optional',
    formPhoneMode: 'hidden',
    formTitleMode: 'optional',
    formContentRequired: false,
    requireLogin: false,
    allowQnA: true,
    reviewItemsPerPage: 5,
    qnaItemsPerPage: 5,
    allowImage: true,
    allowVideo: true,
    allowReply: true,
    replyBadgeText: 'Phản hồi từ Shop',
    replyBgColor: '#f0f5ff',
    replyBorderColor: '#1677ff',
    showVerified: true,
    showVerifiedAll: false,
    reviewLayout: 'list',
    qnaDisplayMode: 'list',
  };

  const CONFIG_CACHE = new Map();
  const MAX_MEDIA_FILES = 5;
  const IMAGE_MAX_SIZE = 500 * 1024;
  const VIDEO_MAX_SIZE = 2 * 1024 * 1024;
  const AVATAR_COLORS = [
    '#f43f5e',
    '#ec4899',
    '#d946ef',
    '#8b5cf6',
    '#6366f1',
    '#3b82f6',
    '#0ea5e9',
    '#06b6d4',
    '#14b8a6',
    '#10b981',
    '#22c55e',
    '#84cc16',
    '#eab308',
    '#f59e0b',
    '#f97316',
  ];

  const normalizeRadius = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, numeric) : DEFAULT_CONFIG.radius;
  };

  function escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function fetchJSON(url, orgId, options = {}) {
    const request = { ...options, headers: { ...(options.headers || {}), 'x-orgid': orgId } };
    if (request.body && !(request.body instanceof FormData)) {
      request.headers['Content-Type'] = 'application/json';
      request.body = JSON.stringify(request.body);
    }
    return fetch(url, request).then(async (response) => {
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        let message = '';
        if (payload && typeof payload === 'object') {
          const nestedMessage = payload.data && typeof payload.data === 'object'
            ? payload.data.message
            : null;
          if (Array.isArray(payload.message)) {
            message = payload.message.join(', ');
          } else if (typeof payload.message === 'string') {
            message = payload.message;
          } else if (typeof nestedMessage === 'string') {
            message = nestedMessage;
          } else if (typeof payload.error === 'string') {
            message = payload.error;
          }
        }
        throw new Error(message || `API Error ${response.status}`);
      }

      if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'data')) {
        return payload.data;
      }
      return payload;
    });
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  }

  function getWidgetConfig(apiUrl, orgId) {
    const cacheKey = `${apiUrl}::${orgId}`;
    if (!CONFIG_CACHE.has(cacheKey)) {
      CONFIG_CACHE.set(
        cacheKey,
        fetchJSON(`${apiUrl}/api/public/reviews/config/widget`, orgId).then((config) => ({
          ...DEFAULT_CONFIG,
          ...(config || {}),
        })).catch(() => ({ ...DEFAULT_CONFIG })),
      );
    }
    return CONFIG_CACHE.get(cacheKey);
  }

  function initials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
  }

  function avatarColor(name) {
    const seed = String(name || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return AVATAR_COLORS[seed % AVATAR_COLORS.length];
  }

  function timeAgo(timestamp) {
    if (!timestamp) return '';
    let seconds = Math.max(0, Math.floor((Date.now() - Number(timestamp)) / 1000));
    if (seconds < 60) return 'Vừa xong';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)} ngày trước`;
    const date = new Date(Number(timestamp));
    const day = `${date.getDate()}`.padStart(2, '0');
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  }

  function maskValue(value, type) {
    if (!value) return '';
    if (type === 'email') {
      const [local, domain] = String(value).split('@');
      if (!local || !domain) return '***';
      const visible = Math.max(2, Math.ceil(local.length / 3));
      return `${local.slice(0, visible)}***@${domain}`;
    }
    const phone = String(value);
    if (phone.length <= 5) return '***';
    return `${phone.slice(0, 3)}***${phone.slice(-2)}`;
  }

  function renderStar(config, filled, size) {
    if (config.starIconUrl) {
      return `<img src="${escapeHTML(config.starIconUrl)}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px;object-fit:contain;opacity:${filled ? '1' : '0.25'}">`;
    }
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" style="color:${filled ? 'var(--f1genzapp-review-star-color)' : 'var(--f1genzapp-review-star-empty)'}"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  }

  function renderStars(config, rating, size) {
    let html = '';
    for (let index = 1; index <= 5; index += 1) {
      html += renderStar(config, Number(rating) >= index, size);
    }
    return html;
  }

  function collectReviewMedia(review, config) {
    const entries = [];
    if (Array.isArray(review.media) && review.media.length) {
      entries.push(...review.media);
    } else {
      if (Array.isArray(review.images)) {
        review.images.forEach((url) => entries.push({ url, type: 'image' }));
      }
      if (review.video) entries.push({ url: review.video, type: 'video' });
    }
    return entries
      .map((item) => ({
        src: typeof item === 'string' ? item : item.url,
        type: typeof item === 'string' ? 'image' : (item.type || 'image'),
      }))
      .filter((item) => item.src && String(item.src).startsWith('http'))
      .filter((item) => (item.type === 'video' ? config.allowVideo !== false : config.allowImage !== false));
  }

  function uploadPublicFile(apiUrl, orgId, productId, file) {
    return fetchJSON(`${apiUrl}/api/public/media/ticket`, orgId, {
      method: 'POST',
      body: {
        productId,
        filename: file.name,
        contentType: file.type,
        fileSize: file.size,
      },
    }).then((ticketData) => {
      const formData = new FormData();
      formData.append('file', file);
      return fetchJSON(
        `${apiUrl}/api/public/media/upload?productId=${encodeURIComponent(productId)}&ticket=${encodeURIComponent(ticketData.ticket)}`,
        orgId,
        { method: 'POST', body: formData },
      );
    });
  }

  function normalizePageSize(value, fallback = 5) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, parsed);
  }

  function getMasonryColumnCount(width) {
    if (width <= 600) return 1;
    if (width <= 900) return 2;
    if (width <= 1200) return 3;
    return 4;
  }

  function splitIntoMasonryColumns(items, columnCount) {
    const totalColumns = Math.max(1, columnCount);
    const columns = Array.from({ length: totalColumns }, () => []);
    items.forEach((item, index) => {
      columns[index % totalColumns].push(item);
    });
    return columns;
  }

  function getPaginationItems(currentPage, totalPages) {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) pages.push('ellipsis-start');
    for (let page = start; page <= end; page += 1) pages.push(page);
    if (end < totalPages - 1) pages.push('ellipsis-end');
    pages.push(totalPages);
    return pages;
  }

  function renderPagination(currentPage, totalPages) {
    if (totalPages <= 1) return '';

    const items = getPaginationItems(currentPage, totalPages);
    return `<nav class="f1genzapp-review-pagination" aria-label="Phân trang">
      <button type="button" class="f1genzapp-review-pagination__btn" data-action="page-prev" ${currentPage <= 1 ? 'disabled' : ''}>Trước</button>
      ${items.map((item) => {
        if (String(item).startsWith('ellipsis')) {
          return '<span class="f1genzapp-review-pagination__ellipsis">...</span>';
        }
        return `<button type="button" class="f1genzapp-review-pagination__btn ${item === currentPage ? 'f1genzapp-review-pagination__btn--active' : ''}" data-action="page-set" data-page="${item}">${item}</button>`;
      }).join('')}
      <button type="button" class="f1genzapp-review-pagination__btn" data-action="page-next" ${currentPage >= totalPages ? 'disabled' : ''}>Sau</button>
    </nav>`;
  }

  class F1GBaseElement extends HTMLElement {
    constructor() {
      super();
      this.config = { ...DEFAULT_CONFIG };
      this.state = {};
      this._bootPromise = null;
    }

    get apiUrl() {
      return API_URL;
    }

    get orgId() {
      return this.getAttribute('orgid') || '';
    }

    get productId() {
      return this.getAttribute('product-id') || '';
    }

    connectedCallback() {
      if (!this._bootPromise) {
        this._bootPromise = this.bootstrap();
      }
    }

    async bootstrap() {
      if (!this.apiUrl || !this.orgId) {
        this.renderPlaceholder('');
        return;
      }
      try {
        this.config = await getWidgetConfig(this.apiUrl, this.orgId);
      } catch {
        this.config = { ...DEFAULT_CONFIG };
      }
      this.applyTheme(this.config);
      await this.initialize();
    }

    async initialize() {}

    applyTheme(config) {
      const radius = normalizeRadius(config.radius);
      const radiusSm = Math.max(0, Math.round(radius * 0.67));
      const radiusXs = Math.max(0, Math.round(radius * 0.5));

      this.style.setProperty('--f1genzapp-review-accent', config.accentColor || DEFAULT_CONFIG.accentColor);
      this.style.setProperty('--f1genzapp-review-star-color', config.starColor || DEFAULT_CONFIG.starColor);
      this.style.setProperty('--f1genzapp-review-star-empty', config.starBgColor || DEFAULT_CONFIG.starBgColor);
      this.style.setProperty('--f1genzapp-review-text', config.textColor || DEFAULT_CONFIG.textColor);
      this.style.setProperty('--f1genzapp-review-text-muted', config.mutedColor || DEFAULT_CONFIG.mutedColor);
      this.style.setProperty('--f1genzapp-review-bg', config.bgColor || DEFAULT_CONFIG.bgColor);
      this.style.setProperty('--f1genzapp-review-bg-alt', config.bgAltColor || DEFAULT_CONFIG.bgAltColor);
      this.style.setProperty('--f1genzapp-review-border', config.borderColor || DEFAULT_CONFIG.borderColor);
      this.style.setProperty('--f1genzapp-review-radius', `${radius}px`);
      this.style.setProperty('--f1genzapp-review-radius-sm', `${radiusSm}px`);
      this.style.setProperty('--f1genzapp-review-radius-xs', `${radiusXs}px`);
      this.style.setProperty('--f1genzapp-review-verified', config.verifiedColor || DEFAULT_CONFIG.verifiedColor);
      this.style.setProperty('--f1genzapp-review-reply-bg', config.replyBgColor || DEFAULT_CONFIG.replyBgColor);
      this.style.setProperty('--f1genzapp-review-reply-border', config.replyBorderColor || DEFAULT_CONFIG.replyBorderColor);
    }

    renderTemplate(markup) {
      this.innerHTML = markup || '';
    }

    renderPlaceholder(message) {
      this.renderTemplate(message ? `<div class="f1genzapp-review-placeholder">${escapeHTML(message)}</div>` : '');
    }
  }

  class F1GReviewsElement extends F1GBaseElement {
    constructor() {
      super();
      this.visibleReviews = [];
      this.previewUrls = [];
      this.handleKeydown = (event) => {
        if (event.key === 'Escape') {
          if (this.state.lightboxOpen) this.closeLightbox();
          else if (this.state.formOpen) this.closeForm();
        }
        if (!this.state.lightboxOpen || !this.state.lightboxItems.length) return;
        if (event.key === 'ArrowLeft') {
          this.state.lightboxIndex = (this.state.lightboxIndex - 1 + this.state.lightboxItems.length) % this.state.lightboxItems.length;
          this.render();
        }
        if (event.key === 'ArrowRight') {
          this.state.lightboxIndex = (this.state.lightboxIndex + 1) % this.state.lightboxItems.length;
          this.render();
        }
      };
      this.handleResize = () => {
        if (this.config.reviewLayout === 'masonry') this.render();
      };
      this.state = {
        loading: true,
        reviews: [],
        summary: { avg: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
        page: 1,
        filterStar: 0,
        filterHasMedia: false,
        sortBy: 'newest',
        formOpen: false,
        formRating: 0,
        formFiles: [],
        formDraft: { title: '', content: '', author: '', email: '', phone: '' },
        formSubmitting: false,
        formError: '',
        formSuccess: '',
        lightboxOpen: false,
        lightboxItems: [],
        lightboxIndex: 0,
      };
      this._eventsBound = false;
    }

    connectedCallback() {
      if (!this._eventsBound) {
        this.addEventListener('click', (event) => this.handleClick(event));
        this.addEventListener('change', (event) => this.handleChange(event));
        this.addEventListener('input', (event) => this.handleInput(event));
        this._eventsBound = true;
      }
      window.addEventListener('keydown', this.handleKeydown);
      window.addEventListener('resize', this.handleResize);
      super.connectedCallback();
    }

    disconnectedCallback() {
      window.removeEventListener('keydown', this.handleKeydown);
      window.removeEventListener('resize', this.handleResize);
      this.syncPreviewUrls([]);
    }

    async initialize() {
      if (!this.productId) {
        this.renderPlaceholder('');
        return;
      }
      if (this.config.allowQnA === false) {
        this.renderTemplate('');
        return;
      }
      this.render();
      await this.reloadData();
    }

    async reloadData(showLoader = true) {
      if (showLoader) {
        this.state.loading = true;
        this.render();
      }
      try {
        const [reviews, summary] = await Promise.all([
          fetchJSON(`${this.apiUrl}/api/public/reviews/${this.productId}`, this.orgId),
          fetchJSON(`${this.apiUrl}/api/public/reviews/${this.productId}/summary`, this.orgId),
        ]);
        this.state.loading = false;
        this.state.reviews = Array.isArray(reviews) ? reviews : [];
        this.state.summary = summary || this.state.summary;
        this.render();
      } catch {
        this.state.loading = false;
        this.renderPlaceholder('');
      }
    }

    syncPreviewUrls(files) {
      this.previewUrls.forEach((url) => URL.revokeObjectURL(url));
      this.previewUrls = files.map((file) => URL.createObjectURL(file));
    }

    getFilteredReviews() {
      let reviews = [...this.state.reviews].sort((left, right) => {
        if (left.pinned && !right.pinned) return -1;
        if (!left.pinned && right.pinned) return 1;
        if (this.state.sortBy === 'oldest') return Number(left.created_at || 0) - Number(right.created_at || 0);
        return Number(right.created_at || 0) - Number(left.created_at || 0);
      });

      if (this.state.filterStar) {
        reviews = reviews.filter((review) => Number(review.rating) === this.state.filterStar);
      }
      if (this.state.filterHasMedia) {
        reviews = reviews.filter((review) => collectReviewMedia(review, this.config).length > 0);
      }
      return reviews;
    }

    handleClick(event) {
      const source = event.target;
      if (!(source instanceof Element)) return;
      if (source.classList.contains('f1genzapp-review-modal-overlay') && source.dataset.kind === 'f1genzapp-review-form') {
        this.closeForm();
        return;
      }
      if (source.classList.contains('f1genzapp-review-lightbox') && source.dataset.kind === 'f1genzapp-review-lightbox') {
        this.closeLightbox();
        return;
      }
      const actionNode = source.closest('[data-action], [data-filter-star], [data-filter-media]');
      if (!actionNode) return;

      const filterStar = actionNode.getAttribute('data-filter-star');
      const filterMedia = actionNode.getAttribute('data-filter-media');
      if (filterStar !== null) {
        const star = Number.parseInt(filterStar, 10);
        this.state.filterStar = star === 0 || this.state.filterStar === star ? 0 : star;
        this.state.filterHasMedia = false;
        this.state.page = 1;
        this.render();
        return;
      }
      if (filterMedia !== null) {
        this.state.filterHasMedia = !this.state.filterHasMedia;
        this.state.filterStar = 0;
        this.state.page = 1;
        this.render();
        return;
      }

      const action = actionNode.getAttribute('data-action');
      if (action === 'open-form') {
        if (this.config.requireLogin) {
          window.location.href = ACCOUNT_LOGIN_URL;
          return;
        }
        this.openForm();
        return;
      }
      if (action === 'close-form') {
        this.closeForm();
        return;
      }
      if (action === 'page-prev') {
        this.state.page = Math.max(1, this.state.page - 1);
        this.render();
        return;
      }
      if (action === 'page-next') {
        this.state.page += 1;
        this.render();
        return;
      }
      if (action === 'page-set') {
        this.state.page = Math.max(1, Number.parseInt(actionNode.getAttribute('data-page') || '1', 10));
        this.render();
        return;
      }
      if (action === 'set-rating') {
        this.state.formRating = Number.parseInt(actionNode.getAttribute('data-rating') || '0', 10);
        this.render();
        return;
      }
      if (action === 'trigger-file') {
        const input = this.querySelector('#f1genzapp-review-input-media');
        if (input) input.click();
        return;
      }
      if (action === 'remove-file') {
        const index = Number.parseInt(actionNode.getAttribute('data-index') || '-1', 10);
        if (index >= 0) {
          this.state.formFiles.splice(index, 1);
          this.syncPreviewUrls(this.state.formFiles);
          this.render();
        }
        return;
      }
      if (action === 'submit-form') {
        this.submitForm();
        return;
      }
      if (action === 'open-media') {
        const reviewIndex = Number.parseInt(actionNode.getAttribute('data-review-index') || '-1', 10);
        const mediaIndex = Number.parseInt(actionNode.getAttribute('data-media-index') || '0', 10);
        const review = this.visibleReviews[reviewIndex];
        if (!review) return;
        const media = collectReviewMedia(review, this.config);
        if (!media.length) return;
        this.state.lightboxOpen = true;
        this.state.lightboxItems = media;
        this.state.lightboxIndex = mediaIndex;
        this.render();
        return;
      }
      if (action === 'close-lightbox') {
        this.closeLightbox();
        return;
      }
      if (action === 'prev-lightbox') {
        this.state.lightboxIndex = (this.state.lightboxIndex - 1 + this.state.lightboxItems.length) % this.state.lightboxItems.length;
        this.render();
        return;
      }
      if (action === 'next-lightbox') {
        this.state.lightboxIndex = (this.state.lightboxIndex + 1) % this.state.lightboxItems.length;
        this.render();
      }
    }

    handleChange(event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.matches('[data-action="sort"]')) {
        this.state.sortBy = target.value;
        this.state.page = 1;
        this.render();
        return;
      }
      if (target.id === 'f1genzapp-review-input-media') {
        const nextFiles = Array.from(target.files || []);
        this.state.formError = '';
        nextFiles.forEach((file) => {
          const isVideo = file.type.startsWith('video/');
          const maxSize = isVideo ? VIDEO_MAX_SIZE : IMAGE_MAX_SIZE;
          if (file.size > maxSize) {
            this.state.formError = `Mỗi ${isVideo ? 'video' : 'ảnh'} chỉ được tối đa ${isVideo ? '2MB' : '500KB'}.`;
            return;
          }
          if (this.state.formFiles.length >= MAX_MEDIA_FILES) {
            this.state.formError = `Chỉ được tải tối đa ${MAX_MEDIA_FILES} tệp.`;
            return;
          }
          this.state.formFiles.push(file);
        });
        target.value = '';
        this.syncPreviewUrls(this.state.formFiles);
        this.render();
      }
    }

    handleInput(event) {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
      if (target.id === 'f1genzapp-review-input-title') this.state.formDraft.title = target.value;
      if (target.id === 'f1genzapp-review-input-content') this.state.formDraft.content = target.value;
      if (target.id === 'f1genzapp-review-input-author') this.state.formDraft.author = target.value;
      if (target.id === 'f1genzapp-review-input-email') this.state.formDraft.email = target.value;
      if (target.id === 'f1genzapp-review-input-phone') this.state.formDraft.phone = target.value;
    }

    openForm() {
      this.state.formOpen = true;
      this.state.formRating = 0;
      this.state.formFiles = [];
      this.state.formDraft = { title: '', content: '', author: '', email: '', phone: '' };
      this.state.formSubmitting = false;
      this.state.formError = '';
      this.state.formSuccess = '';
      this.syncPreviewUrls([]);
      this.render();
    }

    closeForm() {
      this.state.formOpen = false;
      this.state.formRating = 0;
      this.state.formFiles = [];
      this.state.formDraft = { title: '', content: '', author: '', email: '', phone: '' };
      this.state.formSubmitting = false;
      this.state.formError = '';
      this.state.formSuccess = '';
      this.syncPreviewUrls([]);
      this.render();
    }

    closeLightbox() {
      this.state.lightboxOpen = false;
      this.state.lightboxItems = [];
      this.state.lightboxIndex = 0;
      this.render();
    }

    async submitForm() {
      const title = this.state.formDraft.title.trim();
      const content = this.state.formDraft.content.trim();
      const author = this.state.formDraft.author.trim();
      const email = this.state.formDraft.email.trim();
      const phone = this.state.formDraft.phone.trim();

      if (this.config.requireLogin) {
        window.location.href = ACCOUNT_LOGIN_URL;
        return;
      }
      if (!this.state.formRating) {
        this.state.formError = 'Vui lòng chọn số sao đánh giá';
        this.render();
        return;
      }
      if (!author) {
        this.state.formError = 'Vui lòng nhập Họ Tên';
        this.render();
        return;
      }
      if (this.config.formTitleMode === 'required' && !title) {
        this.state.formError = 'Vui lòng nhập Tiêu đề';
        this.render();
        return;
      }
      if (this.config.formContentRequired && !content) {
        this.state.formError = 'Vui lòng nhập Nội dung đánh giá';
        this.render();
        return;
      }
      if (this.config.formEmailMode === 'required' && !email) {
        this.state.formError = 'Vui lòng nhập Email';
        this.render();
        return;
      }
      if (this.config.formPhoneMode === 'required' && !phone) {
        this.state.formError = 'Vui lòng nhập Số điện thoại';
        this.render();
        return;
      }
      if (email && !isValidEmail(email)) {
        this.state.formError = 'Email không đúng định dạng';
        this.render();
        return;
      }

      this.state.formSubmitting = true;
      this.state.formError = '';
      this.render();

      try {
        const uploads = await Promise.all(
          this.state.formFiles.map((file) => uploadPublicFile(this.apiUrl, this.orgId, this.productId, file).catch(() => null)),
        );
        const payload = { rating: this.state.formRating, author };
        if (title) payload.title = title;
        if (content) payload.content = content;
        if (email) payload.email = email;
        if (phone) payload.phone = phone;
        const media = uploads.filter((item) => item && item.url);
        if (media.length) payload.media = media;

        await fetchJSON(`${this.apiUrl}/api/public/reviews/${this.productId}`, this.orgId, {
          method: 'POST',
          body: payload,
        });

        this.state.formSubmitting = false;
        this.state.formSuccess = 'Cảm ơn bạn đã đánh giá. Đánh giá đang chờ duyệt.';
        this.syncPreviewUrls([]);
        this.state.formFiles = [];
        this.state.formDraft = { title: '', content: '', author: '', email: '', phone: '' };
        this.render();
        await this.reloadData(false);
        window.setTimeout(() => this.closeForm(), 2500);
      } catch (error) {
        this.state.formSubmitting = false;
        this.state.formError = error instanceof Error && error.message
          ? error.message
          : 'Gửi thất bại. Vui lòng thử lại sau.';
        this.render();
      }
    }

    renderSummary() {
      const summary = this.state.summary || {};
      const distribution = summary.distribution || {};
      const showAll = !this.state.filterStar && !this.state.filterHasMedia;
      let bars = '';
      for (let star = 5; star >= 1; star -= 1) {
        const count = Number(distribution[star] || 0);
        const percent = summary.count ? ((count / summary.count) * 100).toFixed(1) : 0;
        bars += `<button type="button" class="f1genzapp-review-bar-row">
          <span class="f1genzapp-review-bar-row__label">${star}<span style="color:var(--f1genzapp-review-star-color)">${renderStar(this.config, true, 11)}</span></span>
          <span class="f1genzapp-review-bar-row__track"><span class="f1genzapp-review-bar-row__fill" style="width:${percent}%"></span></span>
          <span class="f1genzapp-review-bar-row__count">${count}</span>
        </button>`;
      }

      let filters = '';
      if (this.config.showFilter) {
        filters += `<div class="f1genzapp-review-controls__filters">
          <button class="f1genzapp-review-pill ${showAll ? 'f1genzapp-review-pill--active' : ''}" data-filter-star="0" data-filter-media="0">Tất cả</button>`;
        for (let star = 5; star >= 1; star -= 1) {
          filters += `<button class="f1genzapp-review-pill ${this.state.filterStar === star ? 'f1genzapp-review-pill--active' : ''}" data-filter-star="${star}">
            ${star}<span style="color:${this.state.filterStar === star ? '#fff' : 'var(--f1genzapp-review-star-color)'}">${renderStar(this.config, true, 11)}</span> (${Number(distribution[star] || 0)})
          </button>`;
        }
        filters += `<button class="f1genzapp-review-pill ${this.state.filterHasMedia ? 'f1genzapp-review-pill--active' : ''}" data-filter-media="1">Có hình ảnh</button></div>`;
      }

      const writeLabel = this.config.requireLogin ? 'Đăng nhập để đánh giá' : 'Viết đánh giá';
      const writeAction = this.config.requireLogin
        ? `<a class="f1genzapp-review-btn--write f1genzapp-review-btn--login" href="${ACCOUNT_LOGIN_URL}" title="Đăng nhập tại /account">${writeLabel}</a>`
        : `<button type="button" class="f1genzapp-review-btn--write" data-action="open-form">${writeLabel}</button>`;
      return `<div class="f1genzapp-review-section">
        ${this.config.showTitle ? `<h2 class="f1genzapp-review-title">${escapeHTML(this.config.titleText)} (${Number(summary.count || 0)})</h2>` : ''}
        <div class="f1genzapp-review-summary">
          <div class="f1genzapp-review-summary__score">
            <span class="f1genzapp-review-summary__avg">${Number(summary.avg || 0).toFixed(1)}</span>
            <div class="f1genzapp-review-summary__stars">${renderStars(this.config, summary.avg || 0, 16)}</div>
            <span class="f1genzapp-review-summary__count">${Number(summary.count || 0)} đánh giá</span>
          </div>
          <div class="f1genzapp-review-summary__bars">${bars}</div>
        </div>
      </div>
      <div class="f1genzapp-review-controls">
        ${filters}
        <div class="f1genzapp-review-controls__actions">
          ${this.config.showSort ? `<select class="f1genzapp-review-select" data-action="sort">
            <option value="newest" ${this.state.sortBy === 'newest' ? 'selected' : ''}>Mới nhất</option>
            <option value="oldest" ${this.state.sortBy === 'oldest' ? 'selected' : ''}>Cũ nhất</option>
          </select>` : ''}
          ${writeAction}
        </div>
      </div>`;
    }

    renderReviewList() {
      const filtered = this.getFilteredReviews();
      if (!filtered.length) {
        this.visibleReviews = [];
        return '<div class="f1genzapp-review-placeholder">Không có đánh giá nào phù hợp.</div>';
      }

      const pageSize = normalizePageSize(this.config.reviewItemsPerPage, 5);
      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      const currentPage = Math.min(this.state.page, totalPages);
      if (currentPage !== this.state.page) this.state.page = currentPage;
      const startIndex = (currentPage - 1) * pageSize;
      this.visibleReviews = filtered.slice(startIndex, startIndex + pageSize);
      const useGrid = this.config.reviewLayout === 'grid';
      const useMasonry = this.config.reviewLayout === 'masonry';
      const renderReviewCard = (review, reviewIndex) => {
        const media = collectReviewMedia(review, this.config);
        const showEmail = this.config.emailDisplay !== 'hidden' && review.email;
        const showPhone = this.config.phoneDisplay !== 'hidden' && review.phone;
        return `<article class="f1genzapp-review-card">
          <div class="f1genzapp-review-card__main">
            <div class="f1genzapp-review-card__top">
              <div class="f1genzapp-review-card__avatar" style="background:${avatarColor(review.author)}">${escapeHTML(initials(review.author))}</div>
              <div class="f1genzapp-review-card__meta">
                <div class="f1genzapp-review-card__name-row">
                  <span class="f1genzapp-review-card__author">${escapeHTML(review.author)}</span>
                  ${(this.config.showVerified && (this.config.showVerifiedAll || review.verified)) ? '<span class="f1genzapp-review-card__verified">Đã mua hàng</span>' : ''}
                  ${this.config.showDate ? `<span class="f1genzapp-review-card__date">${escapeHTML(timeAgo(review.created_at))}</span>` : ''}
                </div>
                <div class="f1genzapp-review-card__stars">${renderStars(this.config, review.rating, 14)}</div>
              </div>
            </div>
            ${(showEmail || showPhone) ? `<div class="f1genzapp-review-card__contact">
              ${showEmail ? `<span class="f1genzapp-review-card__contact-item">${escapeHTML(this.config.emailDisplay === 'mask' ? maskValue(review.email, 'email') : review.email)}</span>` : ''}
              ${showPhone ? `<span class="f1genzapp-review-card__contact-item">${escapeHTML(this.config.phoneDisplay === 'mask' ? maskValue(review.phone, 'phone') : review.phone)}</span>` : ''}
            </div>` : ''}
            ${(this.config.showTitle && review.title) ? `<div class="f1genzapp-review-card__title">${escapeHTML(review.title)}</div>` : ''}
            ${review.content ? `<div class="f1genzapp-review-card__content">${escapeHTML(review.content).replace(/\n/g, '<br>')}</div>` : ''}
          </div>
          ${((this.config.allowReply && review.reply) || media.length) ? `<div class="f1genzapp-review-card__footer">
            ${(this.config.allowReply && review.reply) ? `<div class="f1genzapp-review-card__reply">
              <div class="f1genzapp-review-card__reply-badge">${escapeHTML(this.config.replyBadgeText || 'Phản hồi từ Shop')}</div>
              <div class="f1genzapp-review-card__reply-content">${escapeHTML(review.reply)}</div>
            </div>` : ''}
            ${media.length ? `<div class="f1genzapp-review-card__media">
              ${media.map((item, mediaIndex) => `<button type="button" class="f1genzapp-review-card__media-item" data-action="open-media" data-review-index="${reviewIndex}" data-media-index="${mediaIndex}">
                ${item.type === 'video' ? `<video src="${escapeHTML(item.src)}" muted playsinline></video>` : `<img src="${escapeHTML(item.src)}" loading="lazy" alt="">`}
              </button>`).join('')}
            </div>` : ''}
          </div>` : ''}
        </article>`;
      };
      let content = '';
      if (useMasonry) {
        const columnCount = getMasonryColumnCount(window.innerWidth || 1280);
        const columns = splitIntoMasonryColumns(
          this.visibleReviews.map((review, reviewIndex) => ({ review, reviewIndex })),
          columnCount,
        );
        content += `<div class="f1genzapp-review-masonry" style="--f1genzapp-review-masonry-columns:${columnCount}">`;
        columns.forEach((column) => {
          content += '<div class="f1genzapp-review-masonry__column">';
          column.forEach(({ review, reviewIndex }) => {
            content += renderReviewCard(review, reviewIndex);
          });
          content += '</div>';
        });
        content += '</div>';
      } else {
        if (useGrid) content += '<div class="f1genzapp-review-grid">';
        this.visibleReviews.forEach((review, reviewIndex) => {
          content += renderReviewCard(review, reviewIndex);
        });
        if (useGrid) content += '</div>';
      }
      content += renderPagination(currentPage, totalPages);
      return content;
    }

    renderFormModal() {
      if (!this.state.formOpen) return '';
      if (this.state.formSuccess) {
        return `<div class="f1genzapp-review-modal-overlay" data-kind="f1genzapp-review-form">
          <div class="f1genzapp-review-modal-box">
            <div class="f1genzapp-review-modal-body">
              <div class="f1genzapp-review-placeholder">${escapeHTML(this.state.formSuccess)}</div>
            </div>
          </div>
        </div>`;
      }

      const accept = [];
      if (this.config.allowImage) accept.push('image/jpeg,image/png,image/webp');
      if (this.config.allowVideo) accept.push('video/mp4');
      const draft = this.state.formDraft;

      return `<div class="f1genzapp-review-modal-overlay" data-kind="f1genzapp-review-form">
        <div class="f1genzapp-review-modal-box" role="dialog" aria-modal="true">
          <div class="f1genzapp-review-modal-header">
            <h3 class="f1genzapp-review-modal-title">Viết đánh giá</h3>
            <button type="button" class="f1genzapp-review-modal-close" data-action="close-form" aria-label="Đóng">✕</button>
          </div>
          <div class="f1genzapp-review-modal-body">
            ${this.state.formError ? `<div class="f1genzapp-review-alert">${escapeHTML(this.state.formError)}</div>` : ''}
            <div class="f1genzapp-review-form-group">
              <label class="f1genzapp-review-form-label">Điểm số *</label>
              <div class="f1genzapp-review-modal-stars">
                ${[1, 2, 3, 4, 5].map((rating) => `<button type="button" class="f1genzapp-review-modal-star" data-action="set-rating" data-rating="${rating}" aria-label="${rating} sao">${renderStar(this.config, rating <= this.state.formRating, 32)}</button>`).join('')}
              </div>
            </div>
            ${this.config.formTitleMode !== 'hidden' ? `<div class="f1genzapp-review-form-group">
              <label class="f1genzapp-review-form-label">Tiêu đề${this.config.formTitleMode === 'required' ? ' *' : ''}</label>
              <input class="f1genzapp-review-input" id="f1genzapp-review-input-title" maxlength="100" placeholder="Tóm tắt đánh giá" value="${escapeHTML(draft.title)}">
            </div>` : ''}
            <div class="f1genzapp-review-form-group">
              <label class="f1genzapp-review-form-label">Nội dung${this.config.formContentRequired ? ' *' : ''}</label>
              <textarea class="f1genzapp-review-textarea" id="f1genzapp-review-input-content" maxlength="2000" placeholder="Chia sẻ cảm nhận của bạn về sản phẩm này">${escapeHTML(draft.content)}</textarea>
            </div>
            <div class="f1genzapp-review-modal-row">
              <div class="f1genzapp-review-form-group" style="flex:1">
                <label class="f1genzapp-review-form-label">Họ Tên *</label>
                <input class="f1genzapp-review-input" id="f1genzapp-review-input-author" maxlength="100" placeholder="Nguyễn Văn A" value="${escapeHTML(draft.author)}">
              </div>
              ${this.config.formEmailMode !== 'hidden' ? `<div class="f1genzapp-review-form-group" style="flex:1">
                <label class="f1genzapp-review-form-label">Email${this.config.formEmailMode === 'required' ? ' *' : ''}</label>
                <input class="f1genzapp-review-input" id="f1genzapp-review-input-email" maxlength="200" type="email" placeholder="email@gmail.com" value="${escapeHTML(draft.email)}">
              </div>` : ''}
            </div>
            ${this.config.formPhoneMode !== 'hidden' ? `<div class="f1genzapp-review-form-group">
              <label class="f1genzapp-review-form-label">Số điện thoại${this.config.formPhoneMode === 'required' ? ' *' : ''}</label>
              <input class="f1genzapp-review-input" id="f1genzapp-review-input-phone" maxlength="20" placeholder="0987123456" value="${escapeHTML(draft.phone)}">
            </div>` : ''}
            ${(this.config.allowImage || this.config.allowVideo) ? `<div class="f1genzapp-review-form-group">
              <label class="f1genzapp-review-form-label">Đính kèm ${this.config.allowImage && this.config.allowVideo ? 'Ảnh/Video' : this.config.allowImage ? 'Ảnh' : 'Video'}</label>
              <div class="f1genzapp-review-form-hint">Tối đa 5 tệp. Ảnh tối đa 500KB, video tối đa 2MB.</div>
              <div class="f1genzapp-review-file-wrap">
                <input id="f1genzapp-review-input-media" type="file" multiple accept="${accept.join(',')}" hidden>
                <button type="button" class="f1genzapp-review-btn--outline" data-action="trigger-file">Chọn tệp...</button>
                <span class="f1genzapp-review-file-note">${this.state.formFiles.length ? `${this.state.formFiles.length} tệp đã chọn` : 'Chưa chọn tệp nào'}</span>
              </div>
              ${this.state.formFiles.length ? `<div class="f1genzapp-review-file-preview">
                ${this.state.formFiles.map((file, index) => `<div class="f1genzapp-review-file-thumb">
                  ${file.type.startsWith('video/') ? `<video src="${this.previewUrls[index] || ''}" muted></video>` : `<img src="${this.previewUrls[index] || ''}" alt="${escapeHTML(file.name)}">`}
                  <button type="button" class="f1genzapp-review-file-remove" data-action="remove-file" data-index="${index}">✕</button>
                </div>`).join('')}
              </div>` : ''}
            </div>` : ''}
          </div>
          <div class="f1genzapp-review-modal-footer">
            <button type="button" class="f1genzapp-review-btn" data-action="submit-form" ${this.state.formSubmitting ? 'disabled' : ''}>${this.state.formSubmitting ? 'Đang gửi...' : 'Gửi đánh giá'}</button>
            <button type="button" class="f1genzapp-review-btn f1genzapp-review-btn--outline" data-action="close-form" ${this.state.formSubmitting ? 'disabled' : ''}>Hủy</button>
          </div>
        </div>
      </div>`;
    }

    renderLightbox() {
      if (!this.state.lightboxOpen || !this.state.lightboxItems.length) return '';
      const item = this.state.lightboxItems[this.state.lightboxIndex];
      return `<div class="f1genzapp-review-lightbox" data-action="close-lightbox" data-kind="f1genzapp-review-lightbox">
        <div class="f1genzapp-review-lightbox__inner">
          <button type="button" class="f1genzapp-review-lightbox__close" data-action="close-lightbox">✕</button>
          ${this.state.lightboxItems.length > 1 ? '<button type="button" class="f1genzapp-review-lightbox__nav f1genzapp-review-lightbox__prev" data-action="prev-lightbox">‹</button>' : ''}
          ${item.type === 'video' ? `<video src="${escapeHTML(item.src)}" controls autoplay loop muted playsinline></video>` : `<img src="${escapeHTML(item.src)}" alt="">`}
          ${this.state.lightboxItems.length > 1 ? '<button type="button" class="f1genzapp-review-lightbox__nav f1genzapp-review-lightbox__next" data-action="next-lightbox">›</button>' : ''}
          ${this.state.lightboxItems.length > 1 ? `<div class="f1genzapp-review-lightbox__caption">${this.state.lightboxIndex + 1} / ${this.state.lightboxItems.length}</div>` : ''}
        </div>
      </div>`;
    }

    render() {
      if (this.state.loading) {
        this.renderPlaceholder('Đang tải đánh giá...');
        return;
      }
      this.renderTemplate(`<div class="f1genzapp-review-preview">
          ${this.renderSummary()}
          ${this.renderReviewList()}
          ${this.renderFormModal()}
          ${this.renderLightbox()}
        </div>`,
      );
    }
  }

  class F1GQnaElement extends F1GBaseElement {
    constructor() {
      super();
      this.handleKeydown = (event) => {
        if (event.key === 'Escape' && this.state.formOpen) this.closeForm();
      };
      this.state = {
        loading: true,
        questions: [],
        summary: { total: 0, answered: 0 },
        page: 1,
        formOpen: false,
        formDraft: { author: '', email: '', question: '' },
        formSubmitting: false,
        formError: '',
        formSuccess: '',
      };
      this._eventsBound = false;
    }

    connectedCallback() {
      if (!this._eventsBound) {
        this.addEventListener('click', (event) => this.handleClick(event));
        this.addEventListener('input', (event) => this.handleInput(event));
        this._eventsBound = true;
      }
      window.addEventListener('keydown', this.handleKeydown);
      super.connectedCallback();
    }

    disconnectedCallback() {
      window.removeEventListener('keydown', this.handleKeydown);
    }

    async initialize() {
      if (!this.productId) {
        this.renderPlaceholder('');
        return;
      }
      this.render();
      await this.reloadData();
    }

    async reloadData(showLoader = true) {
      if (showLoader) {
        this.state.loading = true;
        this.render();
      }
      try {
        const [questions, summary] = await Promise.all([
          fetchJSON(`${this.apiUrl}/api/public/qna/${this.productId}`, this.orgId),
          fetchJSON(`${this.apiUrl}/api/public/qna/${this.productId}/summary`, this.orgId),
        ]);
        this.state.loading = false;
        this.state.questions = Array.isArray(questions) ? questions : [];
        this.state.summary = summary || this.state.summary;
        this.render();
      } catch {
        this.state.loading = false;
        this.renderPlaceholder('');
      }
    }

    handleClick(event) {
      const source = event.target;
      if (!(source instanceof Element)) return;
      if (source.classList.contains('f1genzapp-review-modal-overlay') && source.dataset.kind === 'f1genzapp-review-qna-form') {
        this.closeForm();
        return;
      }
      const actionNode = source.closest('[data-action]');
      if (!actionNode) return;

      const action = actionNode.getAttribute('data-action');
      if (action === 'open-form') {
        if (this.config.requireLogin) {
          window.location.href = ACCOUNT_LOGIN_URL;
          return;
        }
        if (this.config.allowQnA !== false) this.openForm();
        return;
      }
      if (action === 'close-form') {
        this.closeForm();
        return;
      }
      if (action === 'page-prev') {
        this.state.page = Math.max(1, this.state.page - 1);
        this.render();
        return;
      }
      if (action === 'page-next') {
        this.state.page += 1;
        this.render();
        return;
      }
      if (action === 'page-set') {
        this.state.page = Math.max(1, Number.parseInt(actionNode.getAttribute('data-page') || '1', 10));
        this.render();
        return;
      }
      if (action === 'submit-form') {
        this.submitForm();
      }
    }

    openForm() {
      this.state.formOpen = true;
      this.state.formDraft = { author: '', email: '', question: '' };
      this.state.formSubmitting = false;
      this.state.formError = '';
      this.state.formSuccess = '';
      this.render();
    }

    closeForm() {
      this.state.formOpen = false;
      this.state.formDraft = { author: '', email: '', question: '' };
      this.state.formSubmitting = false;
      this.state.formError = '';
      this.state.formSuccess = '';
      this.render();
    }

    handleInput(event) {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
      if (target.id === 'f1genzapp-review-input-author') this.state.formDraft.author = target.value;
      if (target.id === 'f1genzapp-review-input-email') this.state.formDraft.email = target.value;
      if (target.id === 'f1genzapp-review-input-question') this.state.formDraft.question = target.value;
    }

    async submitForm() {
      if (this.config.requireLogin) {
        window.location.href = ACCOUNT_LOGIN_URL;
        return;
      }

      const author = this.state.formDraft.author.trim();
      const email = this.state.formDraft.email.trim();
      const question = this.state.formDraft.question.trim();

      if (!author) {
        this.state.formError = 'Vui lòng nhập Họ Tên';
        this.render();
        return;
      }
      if (!question) {
        this.state.formError = 'Vui lòng nhập câu hỏi';
        this.render();
        return;
      }

      this.state.formSubmitting = true;
      this.state.formError = '';
      this.render();

      try {
        if (email && !isValidEmail(email)) {
          throw new Error('Email không đúng định dạng');
        }
        const payload = { author, question };
        if (email) payload.email = email;
        await fetchJSON(`${this.apiUrl}/api/public/qna/${this.productId}`, this.orgId, {
          method: 'POST',
          body: payload,
        });
        this.state.formSubmitting = false;
        this.state.formSuccess = 'Câu hỏi đã được gửi. Chúng tôi sẽ phản hồi sớm nhất.';
        this.state.formDraft = { author: '', email: '', question: '' };
        this.render();
        await this.reloadData(false);
        window.setTimeout(() => this.closeForm(), 2500);
      } catch (error) {
        this.state.formSubmitting = false;
        this.state.formError = error instanceof Error && error.message
          ? error.message
          : 'Gửi thất bại. Vui lòng thử lại sau.';
        this.render();
      }
    }

    renderQuestions() {
      if (!this.state.questions.length) {
        return '<div class="f1genzapp-review-placeholder">Chưa có câu hỏi nào. Hãy là người đầu tiên.</div>';
      }

      const pageSize = normalizePageSize(this.config.qnaItemsPerPage, 5);
      const totalPages = Math.max(1, Math.ceil(this.state.questions.length / pageSize));
      const currentPage = Math.min(this.state.page, totalPages);
      if (currentPage !== this.state.page) this.state.page = currentPage;
      const startIndex = (currentPage - 1) * pageSize;
      const visible = this.state.questions.slice(startIndex, startIndex + pageSize);
      const grid = this.config.qnaDisplayMode === 'grid';
      let markup = grid ? '<div class="f1genzapp-review-qna-grid">' : '';

      visible.forEach((question) => {
        markup += `<article class="f1genzapp-review-qna-card">
          <div class="f1genzapp-review-qna-card__top">
            <div class="f1genzapp-review-qna-card__avatar" style="background:${avatarColor(question.author)}">${escapeHTML(initials(question.author))}</div>
            <div class="f1genzapp-review-qna-card__meta">
              <span class="f1genzapp-review-qna-card__author">${escapeHTML(question.author)}</span>
              ${this.config.showDate ? `<span class="f1genzapp-review-qna-card__date">${escapeHTML(timeAgo(question.created_at))}</span>` : ''}
              <div class="f1genzapp-review-qna-card__question">${escapeHTML(question.question)}</div>
            </div>
          </div>
          ${question.answer ? `<div class="f1genzapp-review-qna-card__answer">
            <div class="f1genzapp-review-qna-card__answer-badge">${escapeHTML(question.answered_by || 'Shop')} trả lời</div>
            <div class="f1genzapp-review-qna-card__answer-text">${escapeHTML(question.answer)}</div>
          </div>` : '<div class="f1genzapp-review-qna-card__pending">Đang chờ trả lời...</div>'}
        </article>`;
      });

      if (grid) markup += '</div>';
      markup += renderPagination(currentPage, totalPages);
      return markup;
    }

    renderFormModal() {
      if (!this.state.formOpen) return '';
      if (this.state.formSuccess) {
        return `<div class="f1genzapp-review-modal-overlay" data-kind="f1genzapp-review-qna-form">
          <div class="f1genzapp-review-modal-box">
            <div class="f1genzapp-review-modal-body">
              <div class="f1genzapp-review-placeholder">${escapeHTML(this.state.formSuccess)}</div>
            </div>
          </div>
        </div>`;
      }

      const draft = this.state.formDraft;

      return `<div class="f1genzapp-review-modal-overlay" data-kind="f1genzapp-review-qna-form">
        <div class="f1genzapp-review-modal-box" role="dialog" aria-modal="true">
          <div class="f1genzapp-review-modal-header">
            <h3 class="f1genzapp-review-modal-title">Đặt câu hỏi</h3>
            <button type="button" class="f1genzapp-review-modal-close" data-action="close-form" aria-label="Đóng">✕</button>
          </div>
          <div class="f1genzapp-review-modal-body">
            ${this.state.formError ? `<div class="f1genzapp-review-alert">${escapeHTML(this.state.formError)}</div>` : ''}
            <div class="f1genzapp-review-modal-row">
              <div class="f1genzapp-review-form-group" style="flex:1">
                <label class="f1genzapp-review-form-label">Họ Tên *</label>
                <input class="f1genzapp-review-input" id="f1genzapp-review-input-author" maxlength="100" placeholder="Nguyễn Văn A" value="${escapeHTML(draft.author)}">
              </div>
              <div class="f1genzapp-review-form-group" style="flex:1">
                <label class="f1genzapp-review-form-label">Email</label>
                <input class="f1genzapp-review-input" id="f1genzapp-review-input-email" maxlength="200" type="email" placeholder="email@gmail.com" value="${escapeHTML(draft.email)}">
              </div>
            </div>
            <div class="f1genzapp-review-form-group">
              <label class="f1genzapp-review-form-label">Câu hỏi *</label>
              <textarea class="f1genzapp-review-textarea" id="f1genzapp-review-input-question" maxlength="1000" placeholder="Bạn muốn hỏi gì về sản phẩm này?">${escapeHTML(draft.question)}</textarea>
            </div>
          </div>
          <div class="f1genzapp-review-modal-footer">
            <button type="button" class="f1genzapp-review-btn" data-action="submit-form" ${this.state.formSubmitting ? 'disabled' : ''}>${this.state.formSubmitting ? 'Đang gửi...' : 'Gửi câu hỏi'}</button>
            <button type="button" class="f1genzapp-review-btn f1genzapp-review-btn--outline" data-action="close-form" ${this.state.formSubmitting ? 'disabled' : ''}>Hủy</button>
          </div>
        </div>
      </div>`;
    }

    render() {
      if (this.config.allowQnA === false) {
        this.renderTemplate('');
        return;
      }
      if (this.state.loading) {
        this.renderPlaceholder('Đang tải hỏi đáp...');
        return;
      }
      const askAction = this.config.requireLogin
        ? `<a class="f1genzapp-review-btn--ask f1genzapp-review-btn--login" href="${ACCOUNT_LOGIN_URL}" title="Đăng nhập tại /account">Đăng nhập để đặt câu hỏi</a>`
        : `<button type="button" class="f1genzapp-review-btn--ask" data-action="open-form">Đặt câu hỏi</button>`;
      this.renderTemplate(`<div class="f1genzapp-review-preview">
          <div class="f1genzapp-review-qna-header">
            <h3>Hỏi đáp (${Number(this.state.summary.total || 0)})</h3>
            <div class="f1genzapp-review-qna-header__actions">
              ${askAction}
            </div>
          </div>
          ${this.renderQuestions()}
          ${this.renderFormModal()}
        </div>`,
      );
    }
  }

  class F1GRatingBadgeElement extends F1GBaseElement {
    static get observedAttributes() {
      return ['avg-rating', 'review-count', 'orgid'];
    }

    async initialize() {
      this.style.display = 'inline-flex';
      this.style.alignItems = 'center';
      this.style.gap = '4px';
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }

    render() {
      const avgRating = Number.parseFloat(this.getAttribute('avg-rating') || '0');
      const reviewCount = Number.parseInt(this.getAttribute('review-count') || '0', 10);

      let stars = '';
      for (let index = 1; index <= 5; index += 1) {
        stars += renderStar(this.config, index <= Math.round(avgRating), 14);
      }

      this.renderTemplate(`<span class="f1genzapp-review-rating-badge">
          <span class="f1genzapp-review-rating-badge__stars" role="img" aria-label="${escapeHTML(avgRating.toFixed(1))} trên 5 sao">${stars}</span>
          <span class="f1genzapp-review-rating-badge__count">(${reviewCount} đánh giá)</span>
        </span>`,
      );
    }
  }

  class F1GReviewsWidgetElement extends HTMLElement {
    connectedCallback() {
      const orgId = this.getAttribute('orgid') || '';
      const productId = this.getAttribute('product-id') || '';
      if (!orgId || !productId) {
        this.innerHTML = '';
        return;
      }

      this.innerHTML = `
        <div class="f1genzapp-review-feedback-stack">
          <f1genz-reviews-panel
            product-id="${escapeHTML(productId)}"
            orgid="${escapeHTML(orgId)}"
          ></f1genz-reviews-panel>
          <f1genz-qna-panel
            product-id="${escapeHTML(productId)}"
            orgid="${escapeHTML(orgId)}"
          ></f1genz-qna-panel>
        </div>
      `;
    }
  }

  if (!customElements.get('f1genz-reviews-panel')) {
    customElements.define('f1genz-reviews-panel', F1GReviewsElement);
  }

  if (!customElements.get('f1genz-qna-panel')) {
    customElements.define('f1genz-qna-panel', F1GQnaElement);
  }

  if (!customElements.get('f1genz-reviews')) {
    customElements.define('f1genz-reviews', F1GReviewsWidgetElement);
  }

  if (!customElements.get('f1genz-rating-badge')) {
    customElements.define('f1genz-rating-badge', F1GRatingBadgeElement);
  }
})();

