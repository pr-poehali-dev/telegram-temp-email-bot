import json
import os
import psycopg2
from datetime import datetime, timedelta

def handler(event: dict, context) -> dict:
    """API для управления Telegram ботом одноразовых почт"""
    
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    try:
        body = json.loads(event.get('body', '{}'))
        action = body.get('action')
        
        db_url = os.environ.get('DATABASE_URL')
        schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
        
        conn = psycopg2.connect(db_url, options=f'-c search_path={schema}')
        conn.autocommit = True
        cursor = conn.cursor()
        
        if action == 'create_user':
            telegram_id = body.get('telegram_id')
            username = body.get('username', '')
            first_name = body.get('first_name', '')
            
            cursor.execute("""
                INSERT INTO users (telegram_id, username, first_name, is_subscribed)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (telegram_id) 
                DO UPDATE SET username = EXCLUDED.username, 
                             first_name = EXCLUDED.first_name,
                             updated_at = CURRENT_TIMESTAMP
                RETURNING id, telegram_id, is_subscribed
            """, (telegram_id, username, first_name, False))
            
            result = cursor.fetchone()
            cursor.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': True,
                    'user': {
                        'id': result[0],
                        'telegram_id': result[1],
                        'is_subscribed': result[2]
                    }
                }),
                'isBase64Encoded': False
            }
        
        elif action == 'update_subscription':
            telegram_id = body.get('telegram_id')
            is_subscribed = body.get('is_subscribed', True)
            
            cursor.execute("""
                UPDATE users 
                SET is_subscribed = %s, updated_at = CURRENT_TIMESTAMP
                WHERE telegram_id = %s
                RETURNING id
            """, (is_subscribed, telegram_id))
            
            result = cursor.fetchone()
            cursor.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': True,
                    'updated': result is not None
                }),
                'isBase64Encoded': False
            }
        
        elif action == 'create_email':
            telegram_id = body.get('telegram_id')
            email = body.get('email')
            country_code = body.get('country_code')
            country_name = body.get('country_name')
            country_flag = body.get('country_flag')
            service_name = body.get('service_name')
            service_emoji = body.get('service_emoji')
            
            cursor.execute("SELECT id FROM users WHERE telegram_id = %s", (telegram_id,))
            user = cursor.fetchone()
            
            if not user:
                cursor.close()
                conn.close()
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'User not found'}),
                    'isBase64Encoded': False
                }
            
            user_id = user[0]
            expires_at = datetime.now() + timedelta(minutes=15)
            
            cursor.execute("""
                INSERT INTO temp_emails 
                (user_id, email, country_code, country_name, country_flag, 
                 service_name, service_emoji, expires_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, email, created_at, expires_at
            """, (user_id, email, country_code, country_name, country_flag,
                  service_name, service_emoji, expires_at))
            
            result = cursor.fetchone()
            cursor.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': True,
                    'email': {
                        'id': result[0],
                        'email': result[1],
                        'created_at': result[2].isoformat(),
                        'expires_at': result[3].isoformat()
                    }
                }),
                'isBase64Encoded': False
            }
        
        elif action == 'update_code':
            email_id = body.get('email_id')
            code = body.get('code')
            
            cursor.execute("""
                UPDATE temp_emails 
                SET received_code = %s
                WHERE id = %s
                RETURNING id, email, received_code
            """, (code, email_id))
            
            result = cursor.fetchone()
            cursor.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': True,
                    'email': {
                        'id': result[0],
                        'email': result[1],
                        'code': result[2]
                    }
                }),
                'isBase64Encoded': False
            }
        
        elif action == 'get_history':
            telegram_id = body.get('telegram_id')
            limit = body.get('limit', 10)
            
            cursor.execute("SELECT id FROM users WHERE telegram_id = %s", (telegram_id,))
            user = cursor.fetchone()
            
            if not user:
                cursor.close()
                conn.close()
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'User not found'}),
                    'isBase64Encoded': False
                }
            
            user_id = user[0]
            
            cursor.execute("""
                SELECT id, email, country_code, country_name, country_flag,
                       service_name, service_emoji, received_code,
                       created_at, expires_at, is_archived
                FROM temp_emails
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT %s
            """, (user_id, limit))
            
            emails = []
            for row in cursor.fetchall():
                emails.append({
                    'id': row[0],
                    'email': row[1],
                    'country_code': row[2],
                    'country_name': row[3],
                    'country_flag': row[4],
                    'service_name': row[5],
                    'service_emoji': row[6],
                    'received_code': row[7],
                    'created_at': row[8].isoformat() if row[8] else None,
                    'expires_at': row[9].isoformat() if row[9] else None,
                    'is_archived': row[10]
                })
            
            cursor.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': True,
                    'emails': emails
                }),
                'isBase64Encoded': False
            }
        
        elif action == 'get_stats':
            telegram_id = body.get('telegram_id')
            
            cursor.execute("SELECT id FROM users WHERE telegram_id = %s", (telegram_id,))
            user = cursor.fetchone()
            
            if not user:
                cursor.close()
                conn.close()
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'User not found'}),
                    'isBase64Encoded': False
                }
            
            user_id = user[0]
            
            cursor.execute("""
                SELECT COUNT(*) as total,
                       COUNT(DISTINCT country_code) as countries,
                       COUNT(DISTINCT service_name) as services
                FROM temp_emails
                WHERE user_id = %s
            """, (user_id,))
            
            stats = cursor.fetchone()
            
            cursor.execute("""
                SELECT service_name, service_emoji, COUNT(*) as count
                FROM temp_emails
                WHERE user_id = %s
                GROUP BY service_name, service_emoji
                ORDER BY count DESC
                LIMIT 3
            """, (user_id,))
            
            popular_services = []
            for row in cursor.fetchall():
                popular_services.append({
                    'name': row[0],
                    'emoji': row[1],
                    'count': row[2]
                })
            
            cursor.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': True,
                    'stats': {
                        'total_emails': stats[0],
                        'countries_used': stats[1],
                        'services_used': stats[2],
                        'popular_services': popular_services
                    }
                }),
                'isBase64Encoded': False
            }
        
        elif action == 'update_settings':
            telegram_id = body.get('telegram_id')
            favorite_service = body.get('favorite_service')
            notifications_enabled = body.get('notifications_enabled', True)
            reminder_enabled = body.get('reminder_enabled', True)
            
            cursor.execute("""
                UPDATE users 
                SET favorite_service = %s,
                    notifications_enabled = %s,
                    reminder_enabled = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE telegram_id = %s
                RETURNING id
            """, (favorite_service, notifications_enabled, reminder_enabled, telegram_id))
            
            result = cursor.fetchone()
            cursor.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': True,
                    'updated': result is not None
                }),
                'isBase64Encoded': False
            }
        
        else:
            cursor.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Unknown action'}),
                'isBase64Encoded': False
            }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }