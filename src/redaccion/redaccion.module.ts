import { Module } from '@nestjs/common';
import { RedaccionController } from './redaccion.controller.js';
import { RedaccionService } from './redaccion.service.js';
import { RedaccionDocxService } from './redaccion-docx.service.js';

@Module({
  controllers: [RedaccionController],
  providers: [RedaccionService, RedaccionDocxService],
})
export class RedaccionModule {}
