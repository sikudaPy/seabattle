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
            #Start game  
            self.Opponent.send(text_data=json.dumps({ "type":"turn_on" }))
            self.send(text_data=json.dumps({ "type":"turn_off" }))

    def receive(self, text_data):

        data_json=json.loads(text_data)

        if(data_json["type"]=="hit"):
            self.Opponent.send(text_data=json.dumps({ "type":"hit", "hit": data_json["hit"] }))

        if(data_json["type"]=="hit_result"):
            self.Opponent.send(text_data=json.dumps({ "type":"hit_result", "hit": data_json["hit"] }))
        
     
        # elif (data_json["type"]=="hit"):
            
        #     if self.turn:
        #         hit_cell=data_json["cell"]
        #         hit = False

        #         if(hit_cell in self.Opponent.shipsLocation):
                    
        #             hit=True
        #             self.turn=True
        #             self.Opponent.turn=False
        #             self.Opponent.shipsLocation.remove(hit_cell)
                    
        #             if not self.Opponent.shipsLocation:
        #                 self.send(text_data=json.dumps({"type":"win"}))
        #                 self.Opponent.send(text_data=json.dumps({"type":"lost"}))
        #         else:
        #             self.turn=False
        #             self.Opponent.turn=True
                    
        #         self.Opponent.send(text_data=json.dumps({"type":"opponent_move", "cell": hit_cell, "hit": hit}))
        #         self.send(text_data=json.dumps({"type":"ack_hit", "cell":hit_cell, "hit": hit}))

                
            
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




