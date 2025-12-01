import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail as MailIcon, Plus, Paperclip, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/UserAvatar";

export default function Mail() {
  // todo: remove mock functionality
  const emails = [
    {
      id: "1",
      from: "Александр Сергеев",
      email: "a.sergeev@interiorplus.ru",
      subject: "Вопрос по чертежам кухни",
      preview: "Здравствуйте! Хотел бы уточнить несколько деталей по чертежам...",
      date: "10:30",
      hasAttachments: true,
      unread: true,
      projectId: "567",
    },
    {
      id: "2",
      from: "Елена Иванова",
      email: "ivanova@mail.ru",
      subject: "Согласование сроков",
      preview: "Добрый день! Можем ли мы перенести дату замера на следующую неделю?",
      date: "Вчера",
      hasAttachments: false,
      unread: false,
      projectId: "568",
    },
    {
      id: "3",
      from: "Дмитрий Ковалев",
      email: "d.kovalev@design-studio.ru",
      subject: "Подписание договора",
      preview: "Отправляю подписанный с нашей стороны договор.",
      date: "08.11",
      hasAttachments: true,
      unread: false,
      projectId: null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Почта</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">Интеграция с email-аккаунтами</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="icon"
            className="md:hidden"
            data-testid="button-connect-email"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            className="hidden md:flex"
            data-testid="button-connect-email-desktop"
          >
            <Plus className="h-4 w-4 mr-2" />
            Подключить почту
          </Button>
          <Button 
            size="icon"
            className="md:hidden"
            data-testid="button-compose"
          >
            <MailIcon className="h-4 w-4" />
          </Button>
          <Button 
            className="hidden md:flex"
            data-testid="button-compose-desktop"
          >
            <MailIcon className="h-4 w-4 mr-2" />
            Написать
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <Card className="w-64 flex-shrink-0">
          <CardHeader>
            <CardTitle className="text-base">Папки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <MailIcon className="h-4 w-4" />
              <span>Входящие</span>
              <Badge variant="secondary" className="ml-auto">3</Badge>
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2">
              <MailIcon className="h-4 w-4" />
              <span>Отправленные</span>
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2">
              <MailIcon className="h-4 w-4" />
              <span>Привязаны к проектам</span>
              <Badge variant="secondary" className="ml-auto">2</Badge>
            </Button>
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Input
                type="search"
                placeholder="Поиск писем..."
                className="max-w-md"
                data-testid="input-search-mail"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {emails.map((email) => (
              <div
                key={email.id}
                className={`p-3 rounded-md border hover-elevate active-elevate-2 cursor-pointer ${
                  email.unread ? "bg-muted/50 border-primary/20" : ""
                }`}
                data-testid={`email-${email.id}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <UserAvatar name={email.from} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${email.unread ? "font-semibold" : ""}`}>
                        {email.from}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{email.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {email.projectId && (
                      <Badge variant="outline" className="text-xs font-mono">#{email.projectId}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{email.date}</span>
                  </div>
                </div>
                <h4 className={`text-sm mb-1 ${email.unread ? "font-semibold" : ""}`}>
                  {email.subject}
                </h4>
                <p className="text-xs text-muted-foreground line-clamp-2">{email.preview}</p>
                {email.hasAttachments && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Paperclip className="h-3 w-3" />
                    <span>Вложения</span>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
