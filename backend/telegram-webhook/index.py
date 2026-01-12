import json
import os
import psycopg2
import requests
from datetime import datetime, timedelta

def handler(event: dict, context) -> dict:
    """Webhook handler для Telegram бота одноразовых почт"""
    
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    try:
        update = json.loads(event.get('body', '{}'))
        bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
        db_url = os.environ.get('DATABASE_URL')
        schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
        
        if not bot_token:
            return response(500, {'error': 'Bot token not configured'})
        
        if 'message' in update:
            return handle_message(update['message'], bot_token, db_url, schema)
        elif 'callback_query' in update:
            return handle_callback(update['callback_query'], bot_token, db_url, schema)
        
        return response(200, {'ok': True})
        
    except Exception as e:
        return response(500, {'error': str(e)})


def handle_message(message: dict, bot_token: str, db_url: str, schema: str) -> dict:
    """Обработка текстовых сообщений"""
    chat_id = message['chat']['id']
    text = message.get('text', '')
    user = message['from']
    
    conn = psycopg2.connect(db_url, options=f'-c search_path={schema}')
    conn.autocommit = True
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO users (telegram_id, username, first_name, is_subscribed)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (telegram_id) 
        DO UPDATE SET username = EXCLUDED.username, 
                     first_name = EXCLUDED.first_name,
                     updated_at = CURRENT_TIMESTAMP
        RETURNING id, is_subscribed
    """, (user['id'], user.get('username', ''), user.get('first_name', ''), False))
    
    user_data = cursor.fetchone()
    is_subscribed = user_data[1]
    
    if text == '/start':
        keyboard = {
            'inline_keyboard': [[
                {'text': '📧 Создать почту', 'callback_data': 'create_email'},
                {'text': '📜 История', 'callback_data': 'history'}
            ], [
                {'text': '📊 Статистика', 'callback_data': 'stats'},
                {'text': '⚙️ Настройки', 'callback_data': 'settings'}
            ], [
                {'text': '📖 Инструкция', 'callback_data': 'help'},
                {'text': '💬 Поддержка', 'callback_data': 'support'}
            ]]
        }
        
        welcome_text = (
            "🚀 <b>Добро пожаловать в бот одноразовых почт!</b>\n\n"
            "📧 Создавайте временные email для безопасной регистрации\n"
            "⏰ Каждая почта работает 15 минут\n"
            "🔒 Полная конфиденциальность и безопасность\n\n"
            "Выберите действие:"
        )
        
        send_message(bot_token, chat_id, welcome_text, keyboard)
    
    elif text == '/help':
        help_text = (
            "📖 <b>Инструкция по использованию</b>\n\n"
            "1️⃣ Нажмите 'Создать почту'\n"
            "2️⃣ Выберите страну\n"
            "3️⃣ Выберите почтовый сервис\n"
            "4️⃣ Получите временный email\n"
            "5️⃣ Коды придут автоматически\n\n"
            "⚠️ Почта удалится через 15 минут"
        )
        send_message(bot_token, chat_id, help_text)
    
    elif text == '/stats':
        cursor.execute("SELECT id FROM users WHERE telegram_id = %s", (user['id'],))
        user_row = cursor.fetchone()
        
        if user_row:
            user_db_id = user_row[0]
            cursor.execute("""
                SELECT COUNT(*) as total,
                       COUNT(DISTINCT country_code) as countries,
                       COUNT(DISTINCT service_name) as services
                FROM temp_emails
                WHERE user_id = %s
            """, (user_db_id,))
            
            stats = cursor.fetchone()
            stats_text = (
                f"📊 <b>Ваша статистика</b>\n\n"
                f"📧 Создано почт: {stats[0]}\n"
                f"🌍 Использовано стран: {stats[1]}\n"
                f"📮 Использовано сервисов: {stats[2]}"
            )
            send_message(bot_token, chat_id, stats_text)
    
    cursor.close()
    conn.close()
    
    return response(200, {'ok': True})


def handle_callback(callback: dict, bot_token: str, db_url: str, schema: str) -> dict:
    """Обработка нажатий на inline-кнопки"""
    callback_id = callback['id']
    chat_id = callback['message']['chat']['id']
    data = callback['data']
    user_id = callback['from']['id']
    
    conn = psycopg2.connect(db_url, options=f'-c search_path={schema}')
    conn.autocommit = True
    cursor = conn.cursor()
    
    if data == 'create_email':
        cursor.execute("SELECT is_subscribed FROM users WHERE telegram_id = %s", (user_id,))
        user_row = cursor.fetchone()
        
        if not user_row or not user_row[0]:
            keyboard = {
                'inline_keyboard': [[
                    {'text': '✅ Подписаться на канал', 'url': 'https://t.me/zidesing'}
                ], [
                    {'text': '🔄 Проверить подписку', 'callback_data': 'check_subscription'}
                ]]
            }
            send_message(bot_token, chat_id, 
                        "⚠️ Для использования бота подпишитесь на наш канал:",
                        keyboard)
        else:
            show_countries(bot_token, chat_id)
    
    elif data == 'check_subscription':
        is_member = check_channel_subscription(bot_token, user_id, '@zidesing')
        
        if is_member:
            cursor.execute("""
                UPDATE users SET is_subscribed = true 
                WHERE telegram_id = %s
            """, (user_id,))
            send_message(bot_token, chat_id, "✅ Подписка подтверждена! Теперь вы можете создавать почты.")
            show_countries(bot_token, chat_id)
        else:
            send_message(bot_token, chat_id, "❌ Подписка не найдена. Пожалуйста, подпишитесь на канал.")
    
    elif data.startswith('country_'):
        country_code = data.split('_')[1]
        show_services(bot_token, chat_id, country_code)
    
    elif data.startswith('service_'):
        parts = data.split('_')
        country_code = parts[1]
        service_name = '_'.join(parts[2:])
        create_temp_email(bot_token, chat_id, user_id, country_code, service_name, cursor)
    
    elif data == 'history':
        show_history(bot_token, chat_id, user_id, cursor)
    
    elif data == 'stats':
        show_stats(bot_token, chat_id, user_id, cursor)
    
    elif data == 'help':
        help_text = (
            "📖 <b>Инструкция</b>\n\n"
            "1️⃣ Выберите страну\n"
            "2️⃣ Выберите почтовый сервис\n"
            "3️⃣ Получите email и коды\n"
            "4️⃣ Почта удалится через 15 минут"
        )
        send_message(bot_token, chat_id, help_text)
    
    elif data == 'support':
        support_text = (
            "💬 <b>Поддержка</b>\n\n"
            "📧 Email: support@tempmail.com\n"
            "💬 Telegram: @support_bot\n"
            "⏰ Работаем 24/7"
        )
        send_message(bot_token, chat_id, support_text)
    
    answer_callback(bot_token, callback_id)
    cursor.close()
    conn.close()
    
    return response(200, {'ok': True})


def show_countries(bot_token: str, chat_id: int):
    """Отображение выбора страны"""
    countries = [
        ('🇷🇺', 'Россия', 'RU'),
        ('🇺🇸', 'США', 'US'),
        ('🇩🇪', 'Германия', 'DE'),
        ('🇫🇷', 'Франция', 'FR'),
        ('🇬🇧', 'Великобритания', 'GB'),
        ('🇯🇵', 'Япония', 'JP'),
        ('🇨🇦', 'Канада', 'CA'),
        ('🇦🇺', 'Австралия', 'AU')
    ]
    
    keyboard = {'inline_keyboard': []}
    for i in range(0, len(countries), 2):
        row = []
        for j in range(2):
            if i + j < len(countries):
                flag, name, code = countries[i + j]
                row.append({'text': f'{flag} {name}', 'callback_data': f'country_{code}'})
        keyboard['inline_keyboard'].append(row)
    
    send_message(bot_token, chat_id, "🌍 <b>Выберите страну:</b>", keyboard)


def show_services(bot_token: str, chat_id: int, country_code: str):
    """Отображение выбора почтового сервиса"""
    services = [
        ('🟡', 'Яндекс', 'yandex'),
        ('🔵', 'Mail.ru', 'mailru'),
        ('🟣', 'Yahoo', 'yahoo'),
        ('🟢', 'ProtonMail', 'proton'),
        ('🔴', 'Gmail', 'gmail'),
        ('🟠', 'Tuta', 'tuta')
    ]
    
    keyboard = {'inline_keyboard': []}
    for emoji, name, code in services:
        keyboard['inline_keyboard'].append([{
            'text': f'{emoji} {name}',
            'callback_data': f'service_{country_code}_{code}'
        }])
    
    keyboard['inline_keyboard'].append([{'text': '🔙 Назад', 'callback_data': 'create_email'}])
    
    send_message(bot_token, chat_id, "📮 <b>Выберите почтовый сервис:</b>", keyboard)


def create_temp_email(bot_token: str, chat_id: int, user_id: int, country_code: str, 
                     service_name: str, cursor):
    """Создание временной почты"""
    cursor.execute("SELECT id FROM users WHERE telegram_id = %s", (user_id,))
    user_row = cursor.fetchone()
    
    if not user_row:
        send_message(bot_token, chat_id, "❌ Ошибка: пользователь не найден")
        return
    
    user_db_id = user_row[0]
    
    email = f"temp{user_id}_{int(datetime.now().timestamp())}@{service_name}.com"
    expires_at = datetime.now() + timedelta(minutes=15)
    
    cursor.execute("""
        INSERT INTO temp_emails 
        (user_id, email, country_code, country_name, country_flag, 
         service_name, service_emoji, expires_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (user_db_id, email, country_code, 'Country', '🌍', 
          service_name, '📧', expires_at))
    
    email_text = (
        f"✅ <b>Временная почта создана!</b>\n\n"
        f"📧 <code>{email}</code>\n\n"
        f"⏰ Действует 15 минут\n"
        f"🔔 Коды придут автоматически"
    )
    
    keyboard = {
        'inline_keyboard': [[
            {'text': '📜 История', 'callback_data': 'history'},
            {'text': '🔄 Создать еще', 'callback_data': 'create_email'}
        ]]
    }
    
    send_message(bot_token, chat_id, email_text, keyboard)


def show_history(bot_token: str, chat_id: int, user_id: int, cursor):
    """Отображение истории почт"""
    cursor.execute("SELECT id FROM users WHERE telegram_id = %s", (user_id,))
    user_row = cursor.fetchone()
    
    if not user_row:
        send_message(bot_token, chat_id, "❌ История пуста")
        return
    
    user_db_id = user_row[0]
    
    cursor.execute("""
        SELECT email, service_name, received_code, created_at, expires_at
        FROM temp_emails
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT 10
    """, (user_db_id,))
    
    emails = cursor.fetchall()
    
    if not emails:
        send_message(bot_token, chat_id, "📭 <b>История пуста</b>\n\nСоздайте свою первую почту!")
        return
    
    history_text = "📜 <b>История почт:</b>\n\n"
    for email, service, code, created, expires in emails:
        status = "✅ Активна" if datetime.now() < expires else "⏰ Истекла"
        code_text = f"\n🔑 Код: <code>{code}</code>" if code else ""
        history_text += (
            f"📧 <code>{email}</code>\n"
            f"📮 {service} | {status}{code_text}\n\n"
        )
    
    send_message(bot_token, chat_id, history_text)


def show_stats(bot_token: str, chat_id: int, user_id: int, cursor):
    """Отображение статистики"""
    cursor.execute("SELECT id FROM users WHERE telegram_id = %s", (user_id,))
    user_row = cursor.fetchone()
    
    if not user_row:
        send_message(bot_token, chat_id, "📊 Статистика недоступна")
        return
    
    user_db_id = user_row[0]
    
    cursor.execute("""
        SELECT COUNT(*) as total,
               COUNT(DISTINCT country_code) as countries,
               COUNT(DISTINCT service_name) as services
        FROM temp_emails
        WHERE user_id = %s
    """, (user_db_id,))
    
    stats = cursor.fetchone()
    
    stats_text = (
        f"📊 <b>Ваша статистика</b>\n\n"
        f"📧 Создано почт: {stats[0]}\n"
        f"🌍 Использовано стран: {stats[1]}\n"
        f"📮 Использовано сервисов: {stats[2]}"
    )
    
    send_message(bot_token, chat_id, stats_text)


def check_channel_subscription(bot_token: str, user_id: int, channel: str) -> bool:
    """Проверка подписки на канал"""
    try:
        url = f"https://api.telegram.org/bot{bot_token}/getChatMember"
        params = {'chat_id': channel, 'user_id': user_id}
        resp = requests.get(url, params=params, timeout=5)
        data = resp.json()
        
        if data.get('ok'):
            status = data['result']['status']
            return status in ['member', 'administrator', 'creator']
        return False
    except:
        return False


def send_message(bot_token: str, chat_id: int, text: str, keyboard=None):
    """Отправка сообщения в Telegram"""
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        'chat_id': chat_id,
        'text': text,
        'parse_mode': 'HTML'
    }
    
    if keyboard:
        payload['reply_markup'] = keyboard
    
    requests.post(url, json=payload, timeout=5)


def answer_callback(bot_token: str, callback_id: str):
    """Ответ на callback query"""
    url = f"https://api.telegram.org/bot{bot_token}/answerCallbackQuery"
    requests.post(url, json={'callback_query_id': callback_id}, timeout=5)


def response(status: int, body: dict) -> dict:
    """Формирование HTTP ответа"""
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(body),
        'isBase64Encoded': False
    }
