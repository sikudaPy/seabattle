import json
from channels.generic.websocket import WebsocketConsumer
from django.template.loader import render_to_string
import threading

class ShipConsumer(WebsocketConsumer):

    lock=threading.Lock()

    #shared between alla the instances
    Queue=''

    def connect(self):
        self.accept()
        msg=json.dumps({
            "type":"Connected"
        })
        self.send(text_data=msg)


    def receive(self, text_data):

        data_json=json.loads(text_data)

        if(data_json["type"]=="begin"):

            ShipConsumer.lock.acquire()
            #if Queue empty, add player to queue
            if not ShipConsumer.Queue:
                self.name=data_json["name"]
                self.shipsLocation=data_json["ships"]
                ShipConsumer.Queue=self

                ShipConsumer.lock.release()

                msg=json.dumps({
                "type":"Queue"
                })
                self.send(text_data=msg)
                self.in_queue=True
            
            #if queue not empty, create session
            else:

                try: 
                    if self.in_queue:
                        self.disconnect()
                except:
                    pass

                self.in_queue=False
                #empty queue
                queuedPlayer=ShipConsumer.Queue
                ShipConsumer.Queue=''

                ShipConsumer.lock.release()
                queuedPlayer.in_queue=False

                self.name=data_json["name"]
                self.shipsLocation=data_json["ships"]

                #send start message to both players to trigger js
                playingPagePlayer1 = render_to_string('game/playing.html', {"playerName": self.name, "opponentName": queuedPlayer.name})
                playingPagePlayer2 = render_to_string('game/playing.html', {"playerName": queuedPlayer.name , "opponentName": self.name})

                diz1={
                    "type": "Start",
                    "page": playingPagePlayer1
                }
                
                diz2={
                    "type": "Start",
                    "page": playingPagePlayer2
                }

                queuedPlayer.send(text_data=json.dumps(diz2))
                self.send(text_data=json.dumps(diz1))

                #set id sessions on both players
                self.idSession=str(self.name+queuedPlayer.name)
                queuedPlayer.idSession=self.idSession

                #set Opponent object on both players
                self.Opponent=queuedPlayer
                queuedPlayer.Opponent=self

                self.send(json.dumps({"type":"turn_on"}))
                self.Opponent.send(json.dumps({"type":"turn_off"}))
                self.turn=True
                self.Opponent.turn=False

            
        elif (data_json["type"]=="hit"):
            
            if self.turn:
                hit_cell=data_json["cell"]
                hit = False

                if(hit_cell in self.Opponent.shipsLocation):
                    
                    hit=True
                    self.turn=True
                    self.Opponent.turn=False
                    self.Opponent.shipsLocation.remove(hit_cell)
                    
                    if not self.Opponent.shipsLocation:
                        self.send(text_data=json.dumps({"type":"win"}))
                        self.Opponent.send(text_data=json.dumps({"type":"lost"}))
                else:
                    self.turn=False
                    self.Opponent.turn=True
                    
                self.Opponent.send(text_data=json.dumps({"type":"opponent_move", "cell": hit_cell, "hit": hit}))
                self.send(text_data=json.dumps({"type":"ack_hit", "cell":hit_cell, "hit": hit}))

                
            
    def disconnect(self, code):
       
        print(code)
        if self.in_queue:
            ShipConsumer.Queue=''
            try:
                ShipConsumer.lock.release()
            except:
                pass
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




