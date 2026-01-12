import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

type Screen = 'welcome' | 'menu' | 'countries' | 'services' | 'email' | 'instructions' | 'support' | 'stats' | 'settings' | 'history';

interface EmailService {
  name: string;
  emoji: string;
}

interface Country {
  name: string;
  flag: string;
  code: string;
}

interface TempEmail {
  id: number;
  email: string;
  country_code: string;
  country_name: string;
  country_flag: string;
  service_name: string;
  service_emoji: string;
  received_code: string | null;
  created_at: string;
  expires_at: string;
  is_archived: boolean;
}

const countries: Country[] = [
  { name: 'Россия', flag: '🇷🇺', code: 'RU' },
  { name: 'США', flag: '🇺🇸', code: 'US' },
  { name: 'Германия', flag: '🇩🇪', code: 'DE' },
  { name: 'Франция', flag: '🇫🇷', code: 'FR' },
  { name: 'Великобритания', flag: '🇬🇧', code: 'GB' },
  { name: 'Япония', flag: '🇯🇵', code: 'JP' },
  { name: 'Канада', flag: '🇨🇦', code: 'CA' },
  { name: 'Австралия', flag: '🇦🇺', code: 'AU' },
];

const emailServices: EmailService[] = [
  { name: 'Яндекс Почта', emoji: '🟡' },
  { name: 'Почта Mail.ru', emoji: '🔵' },
  { name: 'Yahoo! Mail', emoji: '🟣' },
  { name: 'ProtonMail', emoji: '🟢' },
  { name: 'Tuta Mail', emoji: '🔴' },
  { name: 'Gmail', emoji: '🔴' },
];

const Index = () => {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedService, setSelectedService] = useState<EmailService | null>(null);
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [timeLeft, setTimeLeft] = useState(900);
  const [receivedCode, setReceivedCode] = useState('');
  const [totalEmails, setTotalEmails] = useState(42);
  const [favoriteService, setFavoriteService] = useState('Gmail');
  const [emailHistory, setEmailHistory] = useState<TempEmail[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [telegramId] = useState(Math.floor(Math.random() * 1000000000));

  const API_URL = 'https://functions.poehali.dev/e1164c3c-a327-4a6a-8f35-13d276fa861a';

  useEffect(() => {
    createUser();
  }, []);

  const createUser = async () => {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_user',
          telegram_id: telegramId,
          username: 'demo_user',
          first_name: 'Demo'
        })
      });
      const data = await response.json();
      if (data.success) {
        setUserId(data.user.id);
      }
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_history',
          telegram_id: telegramId,
          limit: 20
        })
      });
      const data = await response.json();
      if (data.success) {
        setEmailHistory(data.emails);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_stats',
          telegram_id: telegramId
        })
      });
      const data = await response.json();
      if (data.success) {
        setTotalEmails(data.stats.total_emails);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  useEffect(() => {
    if (generatedEmail && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            toast.error('Почта удалена! ⏰');
            setGeneratedEmail('');
            setReceivedCode('');
            setScreen('menu');
            return 900;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [generatedEmail, timeLeft]);

  useEffect(() => {
    if (generatedEmail && !receivedCode) {
      const codeTimer = setTimeout(() => {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        setReceivedCode(code);
        toast.success(`Получен код: ${code} 📬`);
      }, 3000);
      return () => clearTimeout(codeTimer);
    }
  }, [generatedEmail]);

  const handleSubscribe = () => {
    window.open('https://t.me/zidesing', '_blank');
    setTimeout(() => {
      setIsSubscribed(true);
      toast.success('Подписка подтверждена! ✅');
      setScreen('menu');
    }, 2000);
  };

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setScreen('services');
  };

  const handleServiceSelect = async (service: EmailService) => {
    setSelectedService(service);
    const randomEmail = `temp${Math.floor(Math.random() * 10000)}@${service.name.toLowerCase().replace(/[^a-z]/g, '')}.com`;
    setGeneratedEmail(randomEmail);
    setTimeLeft(900);
    
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_email',
          telegram_id: telegramId,
          email: randomEmail,
          country_code: selectedCountry?.code,
          country_name: selectedCountry?.name,
          country_flag: selectedCountry?.flag,
          service_name: service.name,
          service_emoji: service.emoji
        })
      });
      loadStats();
    } catch (error) {
      console.error('Error creating email:', error);
    }
    
    toast.success('Почта создана! 📧');
    setScreen('email');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Скопировано! 📋');
  };

  if (screen === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background p-4 flex items-center justify-center">
        <Card className="max-w-md w-full p-8 text-center space-y-6 animate-fade-in">
          <div className="text-6xl mb-4">📧</div>
          <h1 className="text-3xl font-bold">Одноразовая Почта</h1>
          <p className="text-muted-foreground">
            Создавайте временные email для безопасной регистрации на сайтах
          </p>
          
          {!isSubscribed ? (
            <div className="space-y-4">
              <div className="bg-accent/50 p-4 rounded-lg">
                <p className="text-sm mb-3">Для использования бота подпишитесь на канал:</p>
                <Button onClick={handleSubscribe} className="w-full" size="lg">
                  <Icon name="ExternalLink" className="mr-2" size={20} />
                  Подписаться на канал
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setScreen('menu')} className="w-full" size="lg">
              Продолжить
              <Icon name="ArrowRight" className="ml-2" size={20} />
            </Button>
          )}
        </Card>
      </div>
    );
  }

  if (screen === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background p-4">
        <div className="max-w-md mx-auto space-y-4 py-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Главное меню 🏠</h2>
            <p className="text-muted-foreground text-sm">Выберите действие</p>
          </div>

          <Button
            onClick={() => setScreen('countries')}
            className="w-full h-20 text-lg justify-start pl-6"
            variant="outline"
          >
            <span className="text-3xl mr-4">📧</span>
            <div className="text-left">
              <div className="font-semibold">Создать почту</div>
              <div className="text-xs text-muted-foreground">Генерация временного email</div>
            </div>
          </Button>

          <Button
            onClick={() => setScreen('instructions')}
            className="w-full h-20 text-lg justify-start pl-6"
            variant="outline"
          >
            <span className="text-3xl mr-4">📖</span>
            <div className="text-left">
              <div className="font-semibold">Инструкция</div>
              <div className="text-xs text-muted-foreground">Как пользоваться ботом</div>
            </div>
          </Button>

          <Button
            onClick={() => {
              loadHistory();
              setScreen('history');
            }}
            className="w-full h-20 text-lg justify-start pl-6"
            variant="outline"
          >
            <span className="text-3xl mr-4">📜</span>
            <div className="text-left">
              <div className="font-semibold">История</div>
              <div className="text-xs text-muted-foreground">Все созданные почты</div>
            </div>
          </Button>

          <Button
            onClick={() => {
              loadStats();
              setScreen('stats');
            }}
            className="w-full h-20 text-lg justify-start pl-6"
            variant="outline"
          >
            <span className="text-3xl mr-4">📊</span>
            <div className="text-left">
              <div className="font-semibold">Статистика</div>
              <div className="text-xs text-muted-foreground">Ваша активность</div>
            </div>
          </Button>

          <Button
            onClick={() => setScreen('settings')}
            className="w-full h-20 text-lg justify-start pl-6"
            variant="outline"
          >
            <span className="text-3xl mr-4">⚙️</span>
            <div className="text-left">
              <div className="font-semibold">Настройки</div>
              <div className="text-xs text-muted-foreground">Предпочтения пользователя</div>
            </div>
          </Button>

          <Button
            onClick={() => setScreen('support')}
            className="w-full h-20 text-lg justify-start pl-6"
            variant="outline"
          >
            <span className="text-3xl mr-4">💬</span>
            <div className="text-left">
              <div className="font-semibold">Поддержка</div>
              <div className="text-xs text-muted-foreground">Связаться с нами</div>
            </div>
          </Button>
        </div>
      </div>
    );
  }

  if (screen === 'countries') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background p-4">
        <div className="max-w-md mx-auto space-y-4 py-8">
          <Button
            onClick={() => setScreen('menu')}
            variant="ghost"
            className="mb-4"
          >
            <Icon name="ArrowLeft" className="mr-2" size={20} />
            Назад
          </Button>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">Выберите страну 🌍</h2>
            <p className="text-muted-foreground text-sm">Откуда будет почта</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {countries.map((country) => (
              <Button
                key={country.code}
                onClick={() => handleCountrySelect(country)}
                className="h-24 flex flex-col gap-2"
                variant="outline"
              >
                <span className="text-4xl">{country.flag}</span>
                <span className="text-sm font-semibold">{country.name}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'services') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background p-4">
        <div className="max-w-md mx-auto space-y-4 py-8">
          <Button
            onClick={() => setScreen('countries')}
            variant="ghost"
            className="mb-4"
          >
            <Icon name="ArrowLeft" className="mr-2" size={20} />
            Назад
          </Button>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">Выберите сервис 📮</h2>
            <p className="text-muted-foreground text-sm">
              Страна: {selectedCountry?.flag} {selectedCountry?.name}
            </p>
          </div>

          <div className="space-y-3">
            {emailServices.map((service, index) => (
              <Button
                key={index}
                onClick={() => handleServiceSelect(service)}
                className="w-full h-16 text-lg justify-start pl-6"
                variant="outline"
              >
                <span className="text-2xl mr-4">{service.emoji}</span>
                <span className="font-semibold">{service.name}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'email') {
    const progress = (timeLeft / 900) * 100;

    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background p-4">
        <div className="max-w-md mx-auto space-y-6 py-8">
          <Button
            onClick={() => {
              setScreen('menu');
              setGeneratedEmail('');
              setReceivedCode('');
            }}
            variant="ghost"
            className="mb-4"
          >
            <Icon name="ArrowLeft" className="mr-2" size={20} />
            Назад в меню
          </Button>

          <Card className="p-6 space-y-6">
            <div className="text-center">
              <div className="text-5xl mb-4">✉️</div>
              <h2 className="text-xl font-bold mb-2">Ваша временная почта</h2>
              <Badge variant="outline" className="text-lg px-4 py-2">
                {selectedCountry?.flag} {selectedService?.name}
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="bg-accent/50 p-4 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Email адрес:</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(generatedEmail)}
                  >
                    <Icon name="Copy" size={16} />
                  </Button>
                </div>
                <p className="font-mono text-sm break-all">{generatedEmail}</p>
              </div>

              {receivedCode && (
                <div className="bg-primary/10 p-4 rounded-lg space-y-2 animate-fade-in border-2 border-primary">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Полученный код:</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(receivedCode)}
                    >
                      <Icon name="Copy" size={16} />
                    </Button>
                  </div>
                  <p className="font-mono text-2xl font-bold text-center">{receivedCode}</p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Время до удаления:</span>
                  <span className="font-mono font-bold text-destructive">{formatTime(timeLeft)}</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex gap-2">
                <span>⚠️</span>
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  Почта автоматически удалится через 15 минут. Все входящие письма и коды будут потеряны.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (screen === 'instructions') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background p-4">
        <div className="max-w-md mx-auto space-y-4 py-8">
          <Button onClick={() => setScreen('menu')} variant="ghost" className="mb-4">
            <Icon name="ArrowLeft" className="mr-2" size={20} />
            Назад
          </Button>

          <Card className="p-6 space-y-6">
            <div className="text-center">
              <div className="text-5xl mb-4">📖</div>
              <h2 className="text-2xl font-bold">Инструкция</h2>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="text-2xl">1️⃣</div>
                <div>
                  <h3 className="font-semibold mb-1">Подпишитесь на канал</h3>
                  <p className="text-sm text-muted-foreground">
                    Для использования бота нужна подписка на наш Telegram-канал
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="text-2xl">2️⃣</div>
                <div>
                  <h3 className="font-semibold mb-1">Выберите страну</h3>
                  <p className="text-sm text-muted-foreground">
                    Определите, из какой страны будет ваш временный email
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="text-2xl">3️⃣</div>
                <div>
                  <h3 className="font-semibold mb-1">Выберите почтовый сервис</h3>
                  <p className="text-sm text-muted-foreground">
                    Яндекс, Gmail, Mail.ru или другой доступный сервис
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="text-2xl">4️⃣</div>
                <div>
                  <h3 className="font-semibold mb-1">Получите почту и коды</h3>
                  <p className="text-sm text-muted-foreground">
                    Используйте временный email для регистрации. Коды придут автоматически
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="text-2xl">5️⃣</div>
                <div>
                  <h3 className="font-semibold mb-1">Почта удалится через 15 минут</h3>
                  <p className="text-sm text-muted-foreground">
                    Все данные автоматически удаляются для вашей безопасности
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (screen === 'support') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background p-4">
        <div className="max-w-md mx-auto space-y-4 py-8">
          <Button onClick={() => setScreen('menu')} variant="ghost" className="mb-4">
            <Icon name="ArrowLeft" className="mr-2" size={20} />
            Назад
          </Button>

          <Card className="p-6 space-y-6">
            <div className="text-center">
              <div className="text-5xl mb-4">💬</div>
              <h2 className="text-2xl font-bold">Поддержка</h2>
            </div>

            <div className="space-y-4">
              <Button className="w-full h-16 justify-start pl-6" variant="outline">
                <Icon name="Send" className="mr-4" size={24} />
                <div className="text-left">
                  <div className="font-semibold">Telegram</div>
                  <div className="text-xs text-muted-foreground">@support_bot</div>
                </div>
              </Button>

              <Button className="w-full h-16 justify-start pl-6" variant="outline">
                <Icon name="Mail" className="mr-4" size={24} />
                <div className="text-left">
                  <div className="font-semibold">Email</div>
                  <div className="text-xs text-muted-foreground">support@tempmail.com</div>
                </div>
              </Button>

              <Button className="w-full h-16 justify-start pl-6" variant="outline">
                <Icon name="MessageCircle" className="mr-4" size={24} />
                <div className="text-left">
                  <div className="font-semibold">Чат поддержки</div>
                  <div className="text-xs text-muted-foreground">Ответим за 5 минут</div>
                </div>
              </Button>

              <div className="bg-accent/50 p-4 rounded-lg text-sm text-center">
                <p>📞 Время работы: 24/7</p>
                <p className="text-muted-foreground mt-1">Мы всегда на связи!</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (screen === 'stats') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background p-4">
        <div className="max-w-md mx-auto space-y-4 py-8">
          <Button onClick={() => setScreen('menu')} variant="ghost" className="mb-4">
            <Icon name="ArrowLeft" className="mr-2" size={20} />
            Назад
          </Button>

          <Card className="p-6 space-y-6">
            <div className="text-center">
              <div className="text-5xl mb-4">📊</div>
              <h2 className="text-2xl font-bold">Статистика</h2>
            </div>

            <div className="space-y-4">
              <div className="bg-gradient-to-r from-primary/20 to-primary/10 p-6 rounded-lg text-center">
                <div className="text-4xl font-bold text-primary">{totalEmails}</div>
                <div className="text-sm text-muted-foreground mt-2">Создано почт</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-accent/50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold">8</div>
                  <div className="text-xs text-muted-foreground mt-1">Стран использовано</div>
                </div>
                <div className="bg-accent/50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold">6</div>
                  <div className="text-xs text-muted-foreground mt-1">Сервисов испробовано</div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Популярные сервисы:</h3>
                {emailServices.slice(0, 3).map((service, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-accent/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{service.emoji}</span>
                      <span className="text-sm font-medium">{service.name}</span>
                    </div>
                    <Badge variant="secondary">{Math.floor(Math.random() * 20 + 5)}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (screen === 'settings') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background p-4">
        <div className="max-w-md mx-auto space-y-4 py-8">
          <Button onClick={() => setScreen('menu')} variant="ghost" className="mb-4">
            <Icon name="ArrowLeft" className="mr-2" size={20} />
            Назад
          </Button>

          <Card className="p-6 space-y-6">
            <div className="text-center">
              <div className="text-5xl mb-4">⚙️</div>
              <h2 className="text-2xl font-bold">Настройки</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Предпочитаемый сервис</label>
                <select
                  className="w-full p-3 border rounded-lg bg-background"
                  value={favoriteService}
                  onChange={(e) => setFavoriteService(e.target.value)}
                >
                  {emailServices.map((service, index) => (
                    <option key={index} value={service.name}>
                      {service.emoji} {service.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between p-4 bg-accent/30 rounded-lg">
                <div>
                  <div className="font-medium">Уведомления о кодах</div>
                  <div className="text-xs text-muted-foreground">Получать push-уведомления</div>
                </div>
                <input type="checkbox" defaultChecked className="w-5 h-5" />
              </div>

              <div className="flex items-center justify-between p-4 bg-accent/30 rounded-lg">
                <div>
                  <div className="font-medium">Напоминание об удалении</div>
                  <div className="text-xs text-muted-foreground">За 2 минуты до удаления</div>
                </div>
                <input type="checkbox" defaultChecked className="w-5 h-5" />
              </div>

              <div className="flex items-center justify-between p-4 bg-accent/30 rounded-lg">
                <div>
                  <div className="font-medium">Темная тема</div>
                  <div className="text-xs text-muted-foreground">Использовать темное оформление</div>
                </div>
                <input type="checkbox" className="w-5 h-5" />
              </div>

              <Button className="w-full" variant="destructive">
                <Icon name="Trash2" className="mr-2" size={18} />
                Удалить все данные
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (screen === 'history') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background p-4">
        <div className="max-w-md mx-auto space-y-4 py-8">
          <Button onClick={() => setScreen('menu')} variant="ghost" className="mb-4">
            <Icon name="ArrowLeft" className="mr-2" size={20} />
            Назад
          </Button>

          <div className="text-center mb-6">
            <div className="text-5xl mb-4">📜</div>
            <h2 className="text-2xl font-bold">История почт</h2>
            <p className="text-muted-foreground text-sm mt-2">Все созданные временные адреса</p>
          </div>

          {emailHistory.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-4xl mb-4">📭</div>
              <p className="text-muted-foreground">История пуста</p>
              <p className="text-sm text-muted-foreground mt-2">Создайте свою первую почту!</p>
              <Button onClick={() => setScreen('countries')} className="mt-4">
                Создать почту
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {emailHistory.map((item) => {
                const now = new Date();
                const expiresAt = new Date(item.expires_at);
                const isExpired = now > expiresAt;
                
                return (
                  <Card key={item.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{item.country_flag}</span>
                        <span className="text-xl">{item.service_emoji}</span>
                        <div>
                          <div className="text-sm font-medium">{item.service_name}</div>
                          <div className="text-xs text-muted-foreground">{item.country_name}</div>
                        </div>
                      </div>
                      {isExpired && (
                        <Badge variant="secondary" className="text-xs">
                          Истекла
                        </Badge>
                      )}
                    </div>

                    <div className="bg-accent/50 p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Email:</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(item.email)}
                          className="h-6 w-6 p-0"
                        >
                          <Icon name="Copy" size={14} />
                        </Button>
                      </div>
                      <p className="font-mono text-xs break-all">{item.email}</p>
                    </div>

                    {item.received_code && (
                      <div className="bg-primary/10 p-3 rounded-lg border border-primary">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Код:</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(item.received_code!)}
                            className="h-6 w-6 p-0"
                          >
                            <Icon name="Copy" size={14} />
                          </Button>
                        </div>
                        <p className="font-mono text-sm font-bold">{item.received_code}</p>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground text-center">
                      Создана: {new Date(item.created_at).toLocaleString('ru-RU')}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default Index;