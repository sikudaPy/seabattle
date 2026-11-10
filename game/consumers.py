import json
from channels.generic.websocket import AsyncWebsocketConsumer

class ShipConsumer(AsyncWebsocketConsumer):

    #shared between alla the instances
    Queue=''

    async def connect(self):
        await self.accept()
        if not ShipConsumer.Queue:
            ShipConsumer.Queue=self
            self.in_queue=True
            
            await self.send(text_data=json.dumps({ "type":"Queue"}))
        else:
            self.in_queue=False       
            self.Opponent=ShipConsumer.Queue
            ShipConsumer.Queue=''
            self.Opponent.Opponent=self 
            #await self.accept()

            #Начало игры - обмен данными
            await self.Opponent.send(text_data=json.dumps({ "type":"start" }))
            await self.send(text_data=json.dumps({ "type":"start" }))

            #задаем очередность ходов
            await self.Opponent.send(text_data=json.dumps({ "type":"turn_on" }))
            await self.send(text_data=json.dumps({ "type":"turn_off" }))

    async def receive(self, text_data):

        data_json=json.loads(text_data)
        #Всегда посылаем оппоненту тоже сообщение, кроме старта
        if self.Opponent and data_json['type'] !="start":
            await self.Opponent.send(text_data=text_data)
         
    async def disconnect(self, code):
       
        print(code)
        if self.in_queue:
            ShipConsumer.Queue=''
        else:
            if code!=1000:
                msg=json.dumps({
                    "type":"Disconnected"
                })
                self.Opponent.send(msg)
            else:
                msg=json.dumps({
                    "type":"O"
                })
                self.Opponent.send(msg)

#Chat for users
class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]

        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        self.room_group_name = f"chat_{self.room_name}"

        # Join room group
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)

        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    # Receive message from WebSocket
    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = text_data_json["message"]

        username = 'anonymous'
        if self.user.is_authenticated:
            username = self.user.username

        # Send message to room group
        await self.channel_layer.group_send(
            self.room_group_name, {"type": "chat.message", "message": username + ": " +message}
        )

    # Receive message from room group
    async def chat_message(self, event):
        message = event["message"]

        # Send message to WebSocket
        await self.send(text_data=json.dumps({"message": message}))


