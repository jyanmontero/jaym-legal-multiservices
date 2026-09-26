import { IsDateString } from 'class-validator';

export class ProgramarBlogPostDto {
  // Fecha (YYYY-MM-DD) en que el cron diario debe publicarlo solo.
  @IsDateString()
  fechaProgramada: string;
}
