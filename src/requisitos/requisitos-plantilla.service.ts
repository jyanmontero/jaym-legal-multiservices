import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequisitoPlantilla } from './requisito-plantilla.entity.js';
import { CreateRequisitoPlantillaDto } from './dto/requisito.dto.js';
import { MateriaJuridica } from '../common/enums/index.js';

@Injectable()
export class RequisitosPlantillaService {
  constructor(
    @InjectRepository(RequisitoPlantilla)
    private readonly plantillaRepo: Repository<RequisitoPlantilla>,
  ) {}

  async crear(dto: CreateRequisitoPlantillaDto): Promise<RequisitoPlantilla> {
    const plantilla = this.plantillaRepo.create({
      ...dto,
      obligatorio: dto.obligatorio ?? true,
      orden: dto.orden ?? 0,
      activo: true,
    });
    return this.plantillaRepo.save(plantilla);
  }

  async listarPorMateria(materia: MateriaJuridica): Promise<RequisitoPlantilla[]> {
    return this.plantillaRepo.find({
      where: { materia, activo: true },
      order: { orden: 'ASC' },
    });
  }

  async listarTodas(): Promise<RequisitoPlantilla[]> {
    return this.plantillaRepo.find({ order: { materia: 'ASC', orden: 'ASC' } });
  }

  async desactivar(id: string): Promise<RequisitoPlantilla> {
    const plantilla = await this.plantillaRepo.findOne({ where: { id } });
    if (!plantilla) throw new NotFoundException('Plantilla de requisito no encontrada');
    // Se desactiva, nunca se borra — expedientes ya creados conservan su
    // copia del requisito independientemente de este cambio.
    plantilla.activo = false;
    return this.plantillaRepo.save(plantilla);
  }
}
