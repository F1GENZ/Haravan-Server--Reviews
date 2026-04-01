import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { join } from 'path';
import { readFileSync, existsSync, statSync } from 'fs';

/**
 * Fallback controller for serving storefront widget JS.
 * Primary serving is via Express static middleware in main.ts.
 * This controller is a backup if the static path doesn't resolve.
 */
@Controller('storefront')
export class StorefrontAssetController {
  private runtimeJs: string | null = null;
  private runtimeCss: string | null = null;
  private lastModified: Date | null = null;
  private filePath: string | null = null;
  private fileMtime: number | null = null;
  private cssLastModified: Date | null = null;
  private cssFilePath: string | null = null;
  private cssFileMtime: number | null = null;

  private getRuntimeJs(): string {
    // Check if cached file has been modified on disk
    if (this.runtimeJs && this.filePath) {
      try {
        const stat = statSync(this.filePath);
        if (stat.mtimeMs !== this.fileMtime) {
          this.runtimeJs = readFileSync(this.filePath, 'utf-8');
          this.fileMtime = stat.mtimeMs;
          this.lastModified = stat.mtime;
        }
        return this.runtimeJs;
      } catch {
        this.runtimeJs = null;
        this.filePath = null;
      }
    }

    const paths = [
      join(__dirname, 'snippets', 'f1genz-storefront.js'),
      join(
        __dirname,
        '..',
        '..',
        '..',
        'storefront',
        'snippets',
        'f1genz-storefront.js',
      ),
      join(
        __dirname,
        '..',
        '..',
        'storefront',
        'snippets',
        'f1genz-storefront.js',
      ),
      join(process.cwd(), 'storefront', 'snippets', 'f1genz-storefront.js'),
      join(
        process.cwd(),
        '..',
        'storefront',
        'snippets',
        'f1genz-storefront.js',
      ),
    ];

    for (const p of paths) {
      if (existsSync(p)) {
        const stat = statSync(p);
        this.runtimeJs = readFileSync(p, 'utf-8');
        this.filePath = p;
        this.fileMtime = stat.mtimeMs;
        this.lastModified = stat.mtime;
        return this.runtimeJs;
      }
    }

    throw new Error('Storefront runtime JS file not found');
  }

  private getRuntimeCss(): string {
    if (this.runtimeCss && this.cssFilePath) {
      try {
        const stat = statSync(this.cssFilePath);
        if (stat.mtimeMs !== this.cssFileMtime) {
          this.runtimeCss = readFileSync(this.cssFilePath, 'utf-8');
          this.cssFileMtime = stat.mtimeMs;
          this.cssLastModified = stat.mtime;
        }
        return this.runtimeCss;
      } catch {
        this.runtimeCss = null;
        this.cssFilePath = null;
      }
    }

    const paths = [
      join(__dirname, 'snippets', 'f1genz-storefront.css'),
      join(
        __dirname,
        '..',
        '..',
        '..',
        'storefront',
        'snippets',
        'f1genz-storefront.css',
      ),
      join(
        __dirname,
        '..',
        '..',
        'storefront',
        'snippets',
        'f1genz-storefront.css',
      ),
      join(process.cwd(), 'storefront', 'snippets', 'f1genz-storefront.css'),
      join(
        process.cwd(),
        '..',
        'storefront',
        'snippets',
        'f1genz-storefront.css',
      ),
    ];

    for (const p of paths) {
      if (existsSync(p)) {
        const stat = statSync(p);
        this.runtimeCss = readFileSync(p, 'utf-8');
        this.cssFilePath = p;
        this.cssFileMtime = stat.mtimeMs;
        this.cssLastModified = stat.mtime;
        return this.runtimeCss;
      }
    }

    throw new Error('Storefront runtime CSS file not found');
  }

  @Get('f1genz-storefront.js')
  serveRuntime(@Res() res: Response) {
    try {
      const js = this.getRuntimeJs();
      res.set({
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      });
      if (this.lastModified) {
        res.set('Last-Modified', this.lastModified.toUTCString());
      }
      res.send(js);
    } catch {
      res.status(404).send('// Widget not found');
    }
  }

  @Get('f1genz-storefront.css')
  serveRuntimeCss(@Res() res: Response) {
    try {
      const css = this.getRuntimeCss();
      res.set({
        'Content-Type': 'text/css; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      });
      if (this.cssLastModified) {
        res.set('Last-Modified', this.cssLastModified.toUTCString());
      }
      res.send(css);
    } catch {
      res.status(404).send('/* Storefront CSS not found */');
    }
  }
}
