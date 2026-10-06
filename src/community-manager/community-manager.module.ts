import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentosModule } from '../documentos/documentos.module.js';
import { BlogModule } from '../blog/blog.module.js';
import { PublicacionRedes } from './publicacion-redes.entity.js';
import { CommunityManagerService } from './community-manager.service.js';
import { CommunityManagerController } from './community-manager.controller.js';
import { CommunityManagerScheduler } from './community-manager.scheduler.js';
import { RedaccionRedesService } from './redaccion-redes.service.js';
import { MetaLegalPublisher } from './publicadores/meta-legal.publisher.js';
import { LinkedinPublisher } from './publicadores/linkedin.publisher.js';
import { ThreadsPublisher } from './publicadores/threads.publisher.js';

@Module({
  // DocumentosModule: AlmacenamientoService (Cloudflare R2) para las imágenes.
  // BlogModule: BlogService, para crear publicaciones a partir de un blog.
  imports: [TypeOrmModule.forFeature([PublicacionRedes]), DocumentosModule, BlogModule],
  controllers: [CommunityManagerController],
  providers: [
    CommunityManagerService,
    CommunityManagerScheduler,
    RedaccionRedesService,
    MetaLegalPublisher,
    LinkedinPublisher,
    ThreadsPublisher,
  ],
})
export class CommunityManagerModule {}
