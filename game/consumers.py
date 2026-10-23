import json
# from channels.generic.websocket import WebsocketConsumer
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




