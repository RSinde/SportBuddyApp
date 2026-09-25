import type { LanguageDictionaries } from '../types';

const dashboard: LanguageDictionaries = {
  en: {
    'dashboard.greeting.morning': 'Good morning',
    'dashboard.greeting.afternoon': 'Good afternoon',
    'dashboard.greeting.evening': 'Good evening',
    'dashboard.subtitle.youHave': 'You have ',
    'dashboard.subtitle.requests': '{count} request{plural}',
    'dashboard.subtitle.toReview': ' to review',
    'dashboard.subtitle.andEventsThisWeek': ' and {count} event{plural} this week',

    'dashboard.stats.followers': 'Followers',
    'dashboard.stats.activeEvents': 'Active events',
    'dashboard.stats.pendingRequests': 'Pending requests',

    'dashboard.upcomingEvents': 'Upcoming events',
    'dashboard.seeAll': 'See all',
    'dashboard.noUpcomingEvents': 'No upcoming events',
    'dashboard.table.event': 'EVENT',
    'dashboard.table.date': 'DATE',
    'dashboard.table.participants': 'PARTICIPANTS',

    'dashboard.noPendingRequests': 'No pending requests',
    'dashboard.seeAllRequests': 'See all {count} requests',

    'myEvents.title': 'My events',
    'myEvents.subtitle.total': '{count} events total · ',
    'myEvents.subtitle.active': '{count} active',

    'myEvents.filter.active': 'Active {count}',
    'myEvents.filter.past': 'Past {count}',
    'myEvents.searchPlaceholder': 'Search event...',

    'myEvents.table.event': 'EVENT',
    'myEvents.table.date': 'DATE',
    'myEvents.table.status': 'STATUS',
    'myEvents.table.participants': 'PARTICIPANTS',
    'myEvents.table.requests': 'REQUESTS',

    'myEvents.status.full': 'Full',
    'myEvents.pendingNew': '{count} new',
    'myEvents.cancelEvent': 'Cancel event',
    'myEvents.noEvents': 'No events',

    'myEvents.confirm.cancelTitle': 'Cancel activity',
    'myEvents.confirm.cancelMessage': 'Are you sure you want to cancel "{title}"?',
    'myEvents.confirm.webMessage': 'Cancel "{title}"? This action cannot be undone.',
    'myEvents.confirm.no': 'No',
    'myEvents.confirm.yesCancel': 'Yes, cancel',

    'myEvents.pagination.showing': 'Showing {shown} of {total} {filterLabel}',
    'myEvents.pagination.activeLabel': 'active',
    'myEvents.pagination.pastLabel': 'past',
  },
  pt: {
    'dashboard.greeting.morning': 'Bom dia',
    'dashboard.greeting.afternoon': 'Boa tarde',
    'dashboard.greeting.evening': 'Boa noite',
    'dashboard.subtitle.youHave': 'Tens ',
    'dashboard.subtitle.requests': '{count} pedido{plural}',
    'dashboard.subtitle.toReview': ' por rever',
    'dashboard.subtitle.andEventsThisWeek': ' e {count} evento{plural} esta semana',

    'dashboard.stats.followers': 'Seguidores',
    'dashboard.stats.activeEvents': 'Eventos ativos',
    'dashboard.stats.pendingRequests': 'Pedidos pendentes',

    'dashboard.upcomingEvents': 'Próximos eventos',
    'dashboard.seeAll': 'Ver todos',
    'dashboard.noUpcomingEvents': 'Sem eventos próximos',
    'dashboard.table.event': 'EVENTO',
    'dashboard.table.date': 'DATA',
    'dashboard.table.participants': 'INSCRITOS',

    'dashboard.noPendingRequests': 'Nenhum pedido pendente',
    'dashboard.seeAllRequests': 'Ver todos os {count} pedidos',

    'myEvents.title': 'Os meus eventos',
    'myEvents.subtitle.total': '{count} eventos no total · ',
    'myEvents.subtitle.active': '{count} ativos',

    'myEvents.filter.active': 'Ativos {count}',
    'myEvents.filter.past': 'Passados {count}',
    'myEvents.searchPlaceholder': 'Pesquisar evento...',

    'myEvents.table.event': 'EVENTO',
    'myEvents.table.date': 'DATA',
    'myEvents.table.status': 'ESTADO',
    'myEvents.table.participants': 'INSCRITOS',
    'myEvents.table.requests': 'PEDIDOS',

    'myEvents.status.full': 'Completa',
    'myEvents.pendingNew': '{count} novo{plural}',
    'myEvents.cancelEvent': 'Cancelar evento',
    'myEvents.noEvents': 'Sem eventos',

    'myEvents.confirm.cancelTitle': 'Cancelar atividade',
    'myEvents.confirm.cancelMessage': 'Tens a certeza que queres cancelar "{title}"?',
    'myEvents.confirm.webMessage': 'Cancelar "{title}"? Esta ação não pode ser desfeita.',
    'myEvents.confirm.no': 'Não',
    'myEvents.confirm.yesCancel': 'Sim, cancelar',

    'myEvents.pagination.showing': 'A mostrar {shown} de {total} {filterLabel}',
    'myEvents.pagination.activeLabel': 'ativos',
    'myEvents.pagination.pastLabel': 'passados',
  },
};

export default dashboard;
