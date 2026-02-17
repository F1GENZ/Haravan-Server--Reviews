import { Controller, Get, Logger, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ShopAuthGuard } from '../common/guards/shop-auth.guard';
import { ShopAuth, ShopOrgId } from '../common/decorators/shop-auth.decorator';
import { RedisService } from '../redis/redis.service';
import { HaravanAPIService } from '../haravan/haravan.api';

type RedisInstallData = {
  orgsub?: string;
};

type ShopData = {
  domain?: string;
  primary_domain?: string;
  myharavan_domain?: string;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
};

const stripPreviewTelemetryScripts = (html: string): string => {
  return html
    .replace(
      /<script[^>]*data-cf-beacon[^>]*>[\s\S]*?<\/script>/gi,
      '',
    )
    .replace(
      /<script[^>]*src=["'][^"']*cloudflareinsights\.com\/beacon[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,
      '',
    )
    .replace(
      /<script[^>]*src=["'][^"']*\/cdn-cgi\/[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,
      '',
    )
    .replace(/https?:\/\/[^"'\s>]+\/cdn-cgi\/rum\?[^"'\s>]*/gi, '')
    .replace(/\/cdn-cgi\/rum\?/gi, '');
};

const PREVIEW_NETWORK_GUARD_SCRIPT = `<script id="fxpage-preview-network-guard">(function(){
  var shouldBlock = function(input){
    var url = String(input || '');
    return /\/cdn-cgi\/rum\?/i.test(url) || /cloudflareinsights\.com\/beacon/i.test(url);
  };

  var normalize = function(input){
    if (typeof input === 'string') return input;
    if (input && typeof input.url === 'string') return input.url;
    return String(input || '');
  };

  try {
    if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  } catch (_) {}

  try {
    var originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
      window.fetch = function(input, init){
        if (shouldBlock(normalize(input))) {
          return Promise.resolve(new Response('', { status: 204 }));
        }
        return originalFetch.call(window, input, init);
      };
    }
  } catch (_) {}

  try {
    var xhrOpen = XMLHttpRequest && XMLHttpRequest.prototype && XMLHttpRequest.prototype.open;
    var xhrSend = XMLHttpRequest && XMLHttpRequest.prototype && XMLHttpRequest.prototype.send;
    if (xhrOpen && xhrSend) {
      XMLHttpRequest.prototype.open = function(method, url){
        this.__fxpageBlocked = shouldBlock(url);
        return xhrOpen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function(){
        if (this.__fxpageBlocked) {
          try { this.abort(); } catch (_) {}
          return;
        }
        return xhrSend.apply(this, arguments);
      };
    }
  } catch (_) {}

  try {
    var originalBeacon = navigator && navigator.sendBeacon;
    if (typeof originalBeacon === 'function') {
      navigator.sendBeacon = function(url, data){
        if (shouldBlock(url)) return true;
        return originalBeacon.call(navigator, url, data);
      };
    }
  } catch (_) {}
})();</script>`;

const PREVIEW_BRIDGE_SCRIPT = `<script id="fxpage-preview-bridge">(function(){
  var SOURCE_BUILDER = 'fxpage-builder';
  var SOURCE_PREVIEW = 'fxpage-preview';
  var raf = null;

  var getString = function(value){
    if (value === undefined || value === null) return '';
    return String(value);
  };

  var isEnabled = function(value){
    return value === true || value === 'true';
  };

  var setText = function(selector, value){
    var element = document.querySelector(selector);
    if (!element) return;
    element.textContent = getString(value);
  };

  var setHtml = function(selector, value){
    var element = document.querySelector(selector);
    if (!element) return;
    element.innerHTML = getString(value);
  };

  var setHref = function(selector, value){
    var element = document.querySelector(selector);
    if (!element) return;
    var href = getString(value).trim();
    if (!href) return;
    element.setAttribute('href', href);
  };

  var setVisible = function(selector, visible){
    var element = document.querySelector(selector);
    if (!element) return;
    element.style.display = visible ? '' : 'none';
  };

  var postScroll = function(){
    try {
      window.parent.postMessage({
        source: SOURCE_PREVIEW,
        type: 'fxpage:scroll',
        x: window.scrollX || 0,
        y: window.scrollY || 0
      }, '*');
    } catch (_) {}
  };

  var scheduleScrollPost = function(){
    if (raf) return;
    raf = window.requestAnimationFrame(function(){
      raf = null;
      postScroll();
    });
  };

  var applyTemplate01Settings = function(values){
    if (!values || typeof values !== 'object') return;

    var body = document.body;
    if (!body) return;

    var bg = getString(values.fxpage01_color_bg).trim();
    var text = getString(values.fxpage01_color_text).trim();
    var accent = getString(values.fxpage01_color_accent).trim();
    if (bg) body.style.setProperty('--fxpage01-bg', bg);
    if (text) body.style.setProperty('--fxpage01-text', text);
    if (accent) body.style.setProperty('--fxpage01-accent', accent);

    var metaTitle = getString(values.fxpage01_meta_title).trim();
    if (metaTitle) document.title = metaTitle;

    var metaDesc = getString(values.fxpage01_meta_desc).trim();
    if (metaDesc) {
      var meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head && document.head.appendChild(meta);
      }
      meta && meta.setAttribute('content', metaDesc);
    }

    setText('.fxpage01-brand-title', values.fxpage01_brand_name);
    setText('.fxpage01-brand-subtitle', values.fxpage01_brand_subtitle);
    setHref('.fxpage01-brand', values.fxpage01_brand_link);
    setText('.fxpage01-hero-badge', values.fxpage01_hero_badge);
    setText('.fxpage01-hero-title', values.fxpage01_hero_title);
    setHtml('.fxpage01-hero-desc', values.fxpage01_hero_desc);
    setText('.fxpage01-btn-primary', values.fxpage01_hero_cta_primary_text);
    setText('.fxpage01-btn-ghost', values.fxpage01_hero_cta_secondary_text);
    setHref('.fxpage01-btn-primary', values.fxpage01_hero_cta_primary_link);
    setHref('.fxpage01-btn-ghost', values.fxpage01_hero_cta_secondary_link);

    setText('#fxpage01-products .fxpage01-section-kicker', values.fxpage01_products_kicker);
    setText('#fxpage01-products .fxpage01-section-title', values.fxpage01_products_title);
    setText('.fxpage01-product-badge', values.fxpage01_featured_badge_text);

    setText('.fxpage01-story-kicker', values.fxpage01_story_kicker);
    setText('.fxpage01-story-title', values.fxpage01_story_title);
    setHtml('.fxpage01-story-desc', values.fxpage01_story_desc);
    setText('.fxpage01-story-point:nth-child(1) .fxpage01-story-point-title', values.fxpage01_story_point_title_1);
    setText('.fxpage01-story-point:nth-child(1) .fxpage01-story-point-desc', values.fxpage01_story_point_desc_1);
    setText('.fxpage01-story-point:nth-child(2) .fxpage01-story-point-title', values.fxpage01_story_point_title_2);
    setText('.fxpage01-story-point:nth-child(2) .fxpage01-story-point-desc', values.fxpage01_story_point_desc_2);
    setText('.fxpage01-story-point:nth-child(3) .fxpage01-story-point-title', values.fxpage01_story_point_title_3);
    setText('.fxpage01-story-point:nth-child(3) .fxpage01-story-point-desc', values.fxpage01_story_point_desc_3);
    setText('.fxpage01-story-point:nth-child(4) .fxpage01-story-point-title', values.fxpage01_story_point_title_4);
    setText('.fxpage01-story-point:nth-child(4) .fxpage01-story-point-desc', values.fxpage01_story_point_desc_4);
    setText('.fxpage01-story-link', values.fxpage01_story_link_text);
    setHref('.fxpage01-story-link', values.fxpage01_story_link);

    var storyImage = document.querySelector('.fxpage01-story-media');
    if (storyImage) {
      var imageSrc = getString(values.fxpage01_story_img).trim();
      if (imageSrc) storyImage.setAttribute('src', imageSrc);
    }

    setText('#fxpage01-journal .fxpage01-section-kicker', values.fxpage01_journal_kicker);
    setText('#fxpage01-journal .fxpage01-section-title', values.fxpage01_journal_title);
    setText('.fxpage01-journal-highlight-body .fxpage01-story-link', values.fxpage01_journal_read_more);

    setText('.fxpage01-footer-title', values.fxpage01_footer_brand);
    setHtml('.fxpage01-footer-copy', values.fxpage01_footer_desc);
    setText('.fxpage01-footer-col:nth-child(2) .fxpage01-footer-head', values.fxpage01_footer_col_1_title);
    setText('.fxpage01-footer-col:nth-child(3) .fxpage01-footer-head', values.fxpage01_footer_col_2_title);
    setText('.fxpage01-footer-bottom', values.fxpage01_footer_bottom);

    var countdownTarget = getString(values.fxpage01_countdown_target).trim();
    if (countdownTarget) body.setAttribute('data-fxpage01-countdown-target', countdownTarget);
    setText('#fxpage01-countdown-days-label', values.fxpage01_countdown_label_days);
    setText('#fxpage01-countdown-hours-label', values.fxpage01_countdown_label_hours);
    setText('#fxpage01-countdown-minutes-label', values.fxpage01_countdown_label_minutes);

    setVisible('#fxpage01-snow', isEnabled(values.fxpage01_show_snow));
    setVisible('#fxpage01-hero', isEnabled(values.fxpage01_show_hero));
    setVisible('#fxpage01-products', isEnabled(values.fxpage01_show_products));
    setVisible('#fxpage01-story', isEnabled(values.fxpage01_show_story));
    setVisible('#fxpage01-journal', isEnabled(values.fxpage01_show_journal));
    setVisible('#fxpage01-countdown', isEnabled(values.fxpage01_show_countdown));
  };

  window.addEventListener('message', function(event){
    var data = event && event.data;
    if (!data || data.source !== SOURCE_BUILDER) return;

    if (data.type === 'fxpage:requestScroll') {
      postScroll();
      return;
    }

    if (data.type === 'fxpage:setScroll') {
      window.scrollTo(Number(data.x || 0), Number(data.y || 0));
      return;
    }

    if (data.type === 'fxpage:setSettings') {
      applyTemplate01Settings(data.payload || {});
    }
  });

  window.addEventListener('scroll', scheduleScrollPost, { passive: true });
  window.addEventListener('load', postScroll);
})();</script>`;

const injectPreviewBridge = (html: string): string => {
  if (html.includes('id="fxpage-preview-bridge"')) return html;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${PREVIEW_BRIDGE_SCRIPT}</body>`);
  }
  return `${html}${PREVIEW_BRIDGE_SCRIPT}`;
};

@Controller('shop')
export class ShopController {
  private readonly logger = new Logger(ShopController.name);

  constructor(
    private readonly redis: RedisService,
    private readonly haravanAPI: HaravanAPIService,
  ) {}

  @UseGuards(ShopAuthGuard)
  @Get()
  async getShopInfo(@ShopAuth() token: string, @ShopOrgId() orgid: string) {
    const tokenData = await this.redis.get<RedisInstallData>(
      `haravan:multipage:app_install:${orgid}`,
    );
    const orgsub = tokenData?.orgsub || '';

    let domain = orgsub ? `${orgsub}.myharavan.com` : '';

    try {
      const shop = (await this.haravanAPI.getShop(token)) as ShopData;
      const customDomain = shop.domain || shop.primary_domain || '';
      const myHaravanDomain = shop.myharavan_domain || domain;
      domain = customDomain || myHaravanDomain;
    } catch (error) {
      this.logger.warn(`Failed to fetch shop info: ${getErrorMessage(error)}`);
    }

    return {
      success: true,
      data: { orgid, orgsub, domain },
    };
  }

  // Proxy preview — fetch page HTML, strip X-Frame-Options
  @UseGuards(ShopAuthGuard)
  @Get('preview')
  async proxyPreview(
    @ShopOrgId() orgid: string,
    @Query('url') url: string,
    @Res() res: Response,
  ) {
    if (!url) {
      return res.status(400).send('Missing url param');
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        redirect: 'follow',
      });

      let html = await response.text();

      html = stripPreviewTelemetryScripts(html);
      html = injectPreviewBridge(html);

      // Rewrite relative URLs to absolute
      const baseUrl = new URL(url);
      const base = `${baseUrl.protocol}//${baseUrl.host}`;

      // Inject <base> + network guard so relative assets load and RUM requests are blocked early
      html = html.replace(
        /<head([^>]*)>/i,
        `<head$1><base href="${base}/">${PREVIEW_NETWORK_GUARD_SCRIPT}`,
      );

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      // Explicitly allow framing
      res.removeHeader('X-Frame-Options');
      res.setHeader('Content-Security-Policy', 'frame-ancestors *');
      res.send(html);
    } catch (error) {
      res.status(502).send('Failed to load preview: ' + getErrorMessage(error));
    }
  }
}
