import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogPost } from './blog-post.entity.js';
import { BlogService } from './blog.service.js';
import { BlogController } from './blog.controller.js';
import { BlogScheduler } from './blog.scheduler.js';
import { RedaccionBlogService } from './redaccion-blog.service.js';
import { WordpressBlogService } from './wordpress-blog.service.js';
import { DocumentosModule } from '../documentos/documentos.module.js';

@Module({
  // DocumentosModule provee AlmacenamientoService (Cloudflare R2), reusado
  // aquí para la imagen destacada de cada blog.
  imports: [TypeOrmModule.forFeature([BlogPost]), DocumentosModule],
  controllers: [BlogController],
  providers: [BlogService, RedaccionBlogService, WordpressBlogService, BlogScheduler],
  exports: [BlogService],
})
export class BlogModule {}
