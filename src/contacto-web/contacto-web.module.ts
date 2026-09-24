import { Module } from '@nestjs/common';
import { ContactoWebService } from './contacto-web.service.js';
import { ContactoWebController } from './contacto-web.controller.js';
import { ClientesModule } from '../clientes/clientes.module.js';

@Module({
  imports: [ClientesModule],
  controllers: [ContactoWebController],
  providers: [ContactoWebService],
})
export class ContactoWebModule {}
