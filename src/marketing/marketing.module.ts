import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnuncioPropiedad } from './anuncio-propiedad.entity.js';
import { MarketingService } from './marketing.service.js';
import { MarketingController } from './marketing.controller.js';
import { MetaGraphService } from './meta-graph.service.js';
import { WordpressPortalService } from './wordpress-portal.service.js';
import { DocumentosModule } from '../documentos/documentos.module.js';

@Module({
  // DocumentosModule provee AlmacenamientoService (Cloudflare R2), reusado
  // aquí para las fotos de propiedades.
  imports: [TypeOrmModule.forFeature([AnuncioPropiedad]), DocumentosModule],
  controllers: [MarketingController],
  providers: [MarketingService, MetaGraphService, WordpressPortalService],
  exports: [MarketingService],
})
export class MarketingModule {}
