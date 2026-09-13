import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolicitudDocumento } from './solicitud-documento.entity.js';
import { Documento } from '../documentos/documento.entity.js';
import { Cliente } from '../clientes/cliente.entity.js';
import { PlantillasService } from './plantillas.service.js';
import { PlantillaPdfService } from './pdf/plantilla-pdf.service.js';
import {
  PlantillasCatalogoController,
  SolicitudesDocumentoPublicoController,
  SolicitudesDocumentoController,
} from './plantillas.controller.js';
import { DocumentosModule } from '../documentos/documentos.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([SolicitudDocumento, Documento, Cliente]), DocumentosModule],
  controllers: [PlantillasCatalogoController, SolicitudesDocumentoPublicoController, SolicitudesDocumentoController],
  providers: [PlantillasService, PlantillaPdfService],
})
export class PlantillasModule {}
