import { Module } from '@nestjs/common';
import { RenderController } from './render/interfaces/render.controller';
import { RenderOrchestrator } from './render/application/render-orchestrator';
import { InMemoryRenderRepository } from './render/infrastructure/in-memory-render.repository';
@Module({controllers:[RenderController],providers:[RenderOrchestrator,InMemoryRenderRepository]})
export class AppModule{}
