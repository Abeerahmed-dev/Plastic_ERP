import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('product_exchanges');
  if (!hasTable) {
    await knex.schema.createTable('product_exchanges', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.string('exchange_number', 50).notNullable().unique();
      table.timestamp('exchange_date', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.uuid('given_product_id').notNullable().references('id').inTable('products').onDelete('RESTRICT');
      table.decimal('given_quantity', 14, 4).notNullable();
      table.decimal('given_unit_cost', 14, 4).notNullable().defaultTo(0);
      table.uuid('received_product_id').notNullable().references('id').inTable('products').onDelete('RESTRICT');
      table.decimal('received_quantity', 14, 4).notNullable();
      table.decimal('received_unit_cost', 14, 4).notNullable().defaultTo(0);
      table.text('notes').nullable();
      table.string('status', 20).notNullable().defaultTo('COMPLETED');
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);

      table.index('exchange_number');
      table.index('given_product_id');
      table.index('received_product_id');
      table.index('exchange_date');
      table.index('created_at');
    });
  }

  // Add permissions for exchanges if not present
  const hasPermissionsTable = await knex.schema.hasTable('permissions');
  if (hasPermissionsTable) {
    const exchangePermissions = [
      { name: 'exchanges:read', module: 'exchanges', action: 'read' },
      { name: 'exchanges:write', module: 'exchanges', action: 'write' },
    ];

    for (const perm of exchangePermissions) {
      const exists = await knex('permissions').where({ name: perm.name }).first();
      if (!exists) {
        await knex('permissions').insert(perm);
      }
    }

    // Assign to Owner, Admin, Cashier
    const roles = await knex('roles').whereIn('name', ['Owner', 'Admin', 'Cashier']).select('id', 'name');
    const perms = await knex('permissions').whereIn('name', ['exchanges:read', 'exchanges:write']).select('id', 'name');

    for (const role of roles) {
      for (const perm of perms) {
        const linkExists = await knex('role_permissions')
          .where({ role_id: role.id, permission_id: perm.id })
          .first();
        if (!linkExists) {
          await knex('role_permissions').insert({
            role_id: role.id,
            permission_id: perm.id,
          });
        }
      }
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('product_exchanges');

  const hasPermissionsTable = await knex.schema.hasTable('permissions');
  if (hasPermissionsTable) {
    const perms = await knex('permissions').whereIn('name', ['exchanges:read', 'exchanges:write']).select('id');
    const permIds = perms.map((p) => p.id);
    if (permIds.length > 0) {
      await knex('role_permissions').whereIn('permission_id', permIds).del();
      await knex('permissions').whereIn('id', permIds).del();
    }
  }
}
