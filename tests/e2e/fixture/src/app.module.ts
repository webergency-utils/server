import { Module } from '@webergency-utils/server';
import { ParseController } from './parse.controller.js';
import { HttpController } from './http.controller.js';
import { ApiKeyGuard, SecureController } from './secure.controller.js';

@Module({
    controllers : [ ParseController, HttpController, SecureController ],
    providers   : [ ApiKeyGuard ]
})
export class AppModule {}
