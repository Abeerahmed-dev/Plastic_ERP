import knex, { Knex } from 'knex';
import { env } from '../config/env';
import knexConfig from '../../knexfile';

const environment = env.NODE_ENV === 'test' ? 'test' : env.NODE_ENV === 'production' ? 'production' : 'development';

const db: Knex = knex(knexConfig[environment]);

export default db;
