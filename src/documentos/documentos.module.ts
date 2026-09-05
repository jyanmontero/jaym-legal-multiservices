import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Documento } from './documento.entity.js';
import { DocumentoPermiso } from './documento-permiso.entity.js';
import { DocumentosService } from './documentos.service.js';
import { DocumentosController } from './documentos.controller.js';
import { ExpedientesModule } from '../expedientes/expedientes.module.js';

@Module({
  // ExpedientesModule provee ExpedientesService.verificarVisibilidadPorId(),
  // usado para que un documento nunca sea más accesible que el expediente
  // al que pertenece (hallazgo de la auditoría de resistencia y seguridad).
  imports: [TypeOrmModule.forFeature([Documento, DocumentoPermiso]), ExpedientesModule],
  controllers: [DocumentosController],
  providers: [DocumentosService],
  exports: [DocumentosService],
})
export class DocumentosModule {}
