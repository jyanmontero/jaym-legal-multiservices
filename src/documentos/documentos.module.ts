import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Documento } from './documento.entity.js';
import { DocumentoPermiso } from './documento-permiso.entity.js';
import { DocumentosService } from './documentos.service.js';
import { DocumentosController } from './documentos.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Documento, DocumentoPermiso])],
  controllers: [DocumentosController],
  providers: [DocumentosService],
  exports: [DocumentosService],
})
export class DocumentosModule {}
