/* Языки интерфейса. Ключ → строка на выбранном языке; если перевода нет, берётся русский. */
const LANGS = [['ru', 'Русский'], ['en', 'English'], ['uk', 'Українська'], ['be', 'Беларуская'], ['zh', '中文']];
const I18N = {
  ru: {
    nav_home: 'Главная', nav_friends: 'Друзья', nav_news: 'Новости', nav_versions: 'Версия игры', nav_packs: 'Модпаки',
    nav_mods: 'Моды', nav_resourcepacks: 'Ресурспаки', nav_shaders: 'Шейдеры', nav_skins: 'Скины', nav_crystals: 'Кристаллики',
    nav_settings: 'Настройки', nav_about: 'О лаунчере',
    grp_game: 'Игра', grp_social: 'Общение', grp_packs: 'Сборки и моды', grp_skins: 'Персонализация',
    tg_link: 'Наш Телеграм', win_min: 'Свернуть', win_max: 'Развернуть', win_close: 'Закрыть',
    online: 'В сети', offline: 'Оффлайн', version_none: 'Версия не выбрана', ready: 'Готово к игре', running: 'Игра запущена',
    set_theme: 'Тема', set_theme_sub: 'Светлая или тёмная', theme_light: 'Светлая', theme_dark: 'Тёмная',
    set_lang: 'Язык', set_lang_sub: 'Язык интерфейса лаунчера', set_nick: 'Ник', set_nick_sub: '3–16 символов: латиница, цифры, _',
    save: 'Сохранить', set_ram: 'Память', set_ram_sub: 'Сколько ОЗУ отдать игре: {0} ГБ',
    set_gamedir: 'Папка игры', set_gamedir_sub: 'Версии, библиотеки, сохранения и моды',
    set_ldir: 'Папка лаунчера', set_ldir_sub: 'Настройки, Java и логи', open: 'Открыть',
    msg_theme: 'Тема мессенджера', msg_full: 'На весь экран', msg_small: 'Маленькое окно', menu: 'Меню лаунчера',
    fr_title: 'Друзья', fr_search: 'Поиск игроков', fr_general: 'Общий чат', fr_helper: 'Помогатор', fr_players: 'Игроки',
    fr_online: 'онлайн', fr_nobody: 'Пока никого', fr_notfound: 'Никого не нашли', fr_you: 'ты',
    about_version: 'Версия', about_sources: 'Моды и модпаки: Modrinth',
    uninstall: 'Удалить лаунчер', uninstall_sub: 'Аккаунт останется на сервере: войти можно по нику и паролю', uninstall_games: 'Удалить также игру, сборки и моды', uninstall_confirm: 'Точно удалить?', uninstall_done: 'Лаунчер удаляется…', uninstall_fail: 'Не получилось удалить',
  },
  en: {
    nav_home: 'Home', nav_friends: 'Friends', nav_news: 'News', nav_versions: 'Game version', nav_packs: 'Modpacks',
    nav_mods: 'Mods', nav_resourcepacks: 'Resource packs', nav_shaders: 'Shaders', nav_skins: 'Skins', nav_crystals: 'Crystals',
    nav_settings: 'Settings', nav_about: 'About',
    grp_game: 'Play', grp_social: 'Social', grp_packs: 'Packs & mods', grp_skins: 'Personalization',
    tg_link: 'Our Telegram', win_min: 'Minimize', win_max: 'Maximize', win_close: 'Close',
    online: 'Online', offline: 'Offline', version_none: 'No version selected', ready: 'Ready to play', running: 'Game running',
    set_theme: 'Theme', set_theme_sub: 'Light or dark', theme_light: 'Light', theme_dark: 'Dark',
    set_lang: 'Language', set_lang_sub: 'Launcher interface language', set_nick: 'Nickname', set_nick_sub: '3–16 characters: Latin letters, digits, _',
    save: 'Save', set_ram: 'Memory', set_ram_sub: 'RAM given to the game: {0} GB',
    set_gamedir: 'Game folder', set_gamedir_sub: 'Versions, libraries, saves and mods',
    set_ldir: 'Launcher folder', set_ldir_sub: 'Settings, Java and logs', open: 'Open',
    msg_theme: 'Messenger theme', msg_full: 'Full screen', msg_small: 'Small window', menu: 'Launcher menu',
    fr_title: 'Friends', fr_search: 'Search players', fr_general: 'General chat', fr_helper: 'Helper', fr_players: 'Players',
    fr_online: 'online', fr_nobody: 'No one yet', fr_notfound: 'No one found', fr_you: 'you',
    about_version: 'Version', about_sources: 'Mods and modpacks: Modrinth',
    uninstall: 'Uninstall launcher', uninstall_sub: 'Your account stays on the server: you can log in with nickname and password', uninstall_games: 'Also delete the game, modpacks and mods', uninstall_confirm: 'Really uninstall?', uninstall_done: 'Uninstalling the launcher…', uninstall_fail: 'Could not uninstall',
  },
  uk: {
    nav_home: 'Головна', nav_friends: 'Друзі', nav_news: 'Новини', nav_versions: 'Версія гри', nav_packs: 'Модпаки',
    nav_mods: 'Моди', nav_resourcepacks: 'Ресурспаки', nav_shaders: 'Шейдери', nav_skins: 'Скіни', nav_crystals: 'Кристалики',
    nav_settings: 'Налаштування', nav_about: 'Про лаунчер',
    grp_game: 'Гра', grp_social: 'Спілкування', grp_packs: 'Збірки і моди', grp_skins: 'Персоналізація',
    tg_link: 'Наш Телеграм', win_min: 'Згорнути', win_max: 'Розгорнути', win_close: 'Закрити',
    online: 'У мережі', offline: 'Офлайн', version_none: 'Версію не вибрано', ready: 'Готово до гри', running: 'Гру запущено',
    set_theme: 'Тема', set_theme_sub: 'Світла або темна', theme_light: 'Світла', theme_dark: 'Темна',
    set_lang: 'Мова', set_lang_sub: 'Мова інтерфейсу лаунчера', set_nick: 'Нік', set_nick_sub: '3–16 символів: латиниця, цифри, _',
    save: 'Зберегти', set_ram: 'Пам’ять', set_ram_sub: 'Скільки ОЗП віддати грі: {0} ГБ',
    set_gamedir: 'Папка гри', set_gamedir_sub: 'Версії, бібліотеки, збереження та моди',
    set_ldir: 'Папка лаунчера', set_ldir_sub: 'Налаштування, Java і логи', open: 'Відкрити',
    msg_theme: 'Тема месенджера', msg_full: 'На весь екран', msg_small: 'Маленьке вікно', menu: 'Меню лаунчера',
    fr_title: 'Друзі', fr_search: 'Пошук гравців', fr_general: 'Загальний чат', fr_helper: 'Помічник', fr_players: 'Гравці',
    fr_online: 'онлайн', fr_nobody: 'Поки нікого', fr_notfound: 'Нікого не знайшли', fr_you: 'ти',
    about_version: 'Версія', about_sources: 'Моди та модпаки: Modrinth',
    uninstall: 'Видалити лаунчер', uninstall_sub: 'Акаунт залишиться на сервері: увійти можна за ніком і паролем', uninstall_games: 'Видалити також гру, збірки та моди', uninstall_confirm: 'Точно видалити?', uninstall_done: 'Лаунчер видаляється…', uninstall_fail: 'Не вдалося видалити',
  },
  be: {
    nav_home: 'Галоўная', nav_friends: 'Сябры', nav_news: 'Навіны', nav_versions: 'Версія гульні', nav_packs: 'Модпакі',
    nav_mods: 'Моды', nav_resourcepacks: 'Рэсурспакі', nav_shaders: 'Шэйдары', nav_skins: 'Скіны', nav_crystals: 'Крышталікі',
    nav_settings: 'Налады', nav_about: 'Пра лаўнчар',
    grp_game: 'Гульня', grp_social: 'Зносіны', grp_packs: 'Зборкі і моды', grp_skins: 'Персаналізацыя',
    tg_link: 'Наш Telegram', win_min: 'Згарнуць', win_max: 'Разгарнуць', win_close: 'Зачыніць',
    online: 'У сетцы', offline: 'Афлайн', version_none: 'Версія не абрана', ready: 'Гатова да гульні', running: 'Гульня запушчана',
    set_theme: 'Тэма', set_theme_sub: 'Светлая або цёмная', theme_light: 'Светлая', theme_dark: 'Цёмная',
    set_lang: 'Мова', set_lang_sub: 'Мова інтэрфейсу лаўнчара', set_nick: 'Нік', set_nick_sub: '3–16 знакаў: лацінка, лічбы, _',
    save: 'Захаваць', set_ram: 'Памяць', set_ram_sub: 'Колькі ОЗП аддаць гульні: {0} ГБ',
    set_gamedir: 'Папка гульні', set_gamedir_sub: 'Версіі, бібліятэкі, захаванні і моды',
    set_ldir: 'Папка лаўнчара', set_ldir_sub: 'Налады, Java і логі', open: 'Адкрыць',
    msg_theme: 'Тэма месенджара', msg_full: 'На ўвесь экран', msg_small: 'Невялікае акно', menu: 'Меню лаўнчара',
    fr_title: 'Сябры', fr_search: 'Пошук гульцоў', fr_general: 'Агульны чат', fr_helper: 'Памочнік', fr_players: 'Гульцы',
    fr_online: 'анлайн', fr_nobody: 'Пакуль нікога', fr_notfound: 'Нікога не знайшлі', fr_you: 'ты',
    about_version: 'Версія', about_sources: 'Моды і модпакі: Modrinth',
    uninstall: 'Выдаліць лаўнчар', uninstall_sub: 'Акаўнт застанецца на серверы: увайсці можна па ніку і паролі', uninstall_games: 'Выдаліць таксама гульню, зборкі і моды', uninstall_confirm: 'Дакладна выдаліць?', uninstall_done: 'Лаўнчар выдаляецца…', uninstall_fail: 'Не атрымалася выдаліць',
  },
  zh: {
    nav_home: '主页', nav_friends: '好友', nav_news: '新闻', nav_versions: '游戏版本', nav_packs: '整合包',
    nav_mods: '模组', nav_resourcepacks: '资源包', nav_shaders: '光影', nav_skins: '皮肤', nav_crystals: '水晶',
    nav_settings: '设置', nav_about: '关于',
    grp_game: '游戏', grp_social: '社交', grp_packs: '整合包与模组', grp_skins: '个性化',
    tg_link: '我们的 Telegram', win_min: '最小化', win_max: '最大化', win_close: '关闭',
    online: '在线', offline: '离线', version_none: '未选择版本', ready: '准备就绪', running: '游戏运行中',
    set_theme: '主题', set_theme_sub: '浅色或深色', theme_light: '浅色', theme_dark: '深色',
    set_lang: '语言', set_lang_sub: '启动器界面语言', set_nick: '昵称', set_nick_sub: '3–16 个字符：拉丁字母、数字、_',
    save: '保存', set_ram: '内存', set_ram_sub: '分配给游戏的内存：{0} GB',
    set_gamedir: '游戏文件夹', set_gamedir_sub: '版本、库、存档和模组',
    set_ldir: '启动器文件夹', set_ldir_sub: '设置、Java 和日志', open: '打开',
    msg_theme: '聊天主题', msg_full: '全屏', msg_small: '小窗口', menu: '启动器菜单',
    fr_title: '好友', fr_search: '搜索玩家', fr_general: '公共聊天', fr_helper: '助手', fr_players: '玩家',
    fr_online: '在线', fr_nobody: '暂无', fr_notfound: '没有找到', fr_you: '你',
    about_version: '版本', about_sources: '模组与整合包：Modrinth',
    uninstall: '卸载启动器', uninstall_sub: '账号保留在服务器上：可用昵称和密码登录', uninstall_games: '同时删除游戏、整合包和模组', uninstall_confirm: '确定卸载？', uninstall_done: '正在卸载启动器…', uninstall_fail: '无法卸载',
  },
};
// текущий язык: сохраняется в браузерном хранилище лаунчера; без хранилища — русский
let LANG = 'ru';
try { const v = localStorage.getItem('beluvu-lang'); if (I18N[v]) LANG = v; } catch (e) { /* без хранилища — русский */ }
function tr(key, ...args) {
  const s = (I18N[LANG] && I18N[LANG][key]) || I18N.ru[key] || key;
  return s.replace(/\{(\d+)\}/g, (_, i) => args[i] ?? '');
}
function setLang(l) {
  if (!I18N[l]) return;
  LANG = l;
  try { localStorage.setItem('beluvu-lang', l); } catch (e) { /* без хранилища — не страшно */ }
  document.documentElement.lang = l === 'zh' ? 'zh' : l;
}
document.documentElement.lang = LANG;
