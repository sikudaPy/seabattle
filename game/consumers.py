import json
from channels.generic.websocket import WebsocketConsumer

class ShipConsumer(WebsocketConsumer):

    #shared between alla the instances
    Queue=''

    def connect(self):
        self.accept()
        if not ShipConsumer.Queue:
            ShipConsumer.Queue=self
            self.in_queue=True
            self.send(text_data=json.dumps({ "type":"Queue"}))
        else:
            self.in_queue=False       
            self.Opponent=ShipConsumer.Queue
            ShipConsumer.Queue=''
            self.Opponent.Opponent=self 
            #Начало игры - обмен данными
            self.Opponent.send(text_data=json.dumps({ "type":"start" }))
            self.send(text_data=json.dumps({ "type":"start" }))

            #задаем очередность ходов
            self.Opponent.send(text_data=json.dumps({ "type":"turn_on" }))
            self.send(text_data=json.dumps({ "type":"turn_off" }))

    def receive(self, text_data):

        data_json=json.loads(text_data)
        #Всегда посылаем оппоненту тоже сообщение, кроме старта
        if self.Opponent and data_json['type'] !="start":
            self.Opponent.send(text_data=text_data)
         
    def disconnect(self, code):
       
        print(code)
        if self.in_queue:
            ShipConsumer.Queue=''
            # try:
            #     #ShipConsumer.lock.release()
            # except:
            #     pass
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




