'use strict';

module.exports = function(RED) {

    function AnamicoAlarmTriggered(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        this.format = parseInt(config.format || '0');
        this._panel = RED.nodes.getNode(config.panel);
        this.delay = typeof config.delay === 'string' ? parseInt( config.delay ) : 10;
        if (isNaN(this.delay)) {
            this.delay == 10;
        }
        this.timer = null;
        this.hasAlarmed = false;
        this.trigger = null;

        /**
         * fire the alarm output
         */
        function emitAlarm( msg ) {


             return function(){
                node.counter = node.counter - 1;
                if (node.counter > 0) {
                    node.status({
                        fill:   "grey",
                        shape:  "dot",
                        text:   "" + node.counter
                    });
                    node.timer = setTimeout(emitAlarm(msg), 1000);
                    return;
                }
                node.timer = null;
                node.hasAlarmed = true;
                node.status({
                    fill:   "red" ,
                    shape:  "dot",
                    text:   node._panel.alarmModes[node._panel.alarmState]
                });
                var data =  {payload: { alarm: true }};

                var sensorName = msg.payload.sensorName;
                
                if( sensorName ){
                    data.payload.sensorName = sensorName;
                }
                node.send(data);
            }
        }

        function clearAlarm() {
            if (node.timer) {
                clearTimeout(node.timer);
                node.timer = null;
            }
            node.status({});
            if( node.hasAlarmed ){
                node.send({payload: { alarm: false }});
            }
            node.hasAlarmed = false;
        }

        /**
         * listen for panel state changes
         */
        node._panel && node._panel.registerStateListener(this, function(msg) {
            const SecuritySystemCurrentState = msg.payload.SecuritySystemCurrentState;
            const SecuritySystemAlarmType = msg.payload.SecuritySystemAlarmType;
            //
            // alarm state
            //
            if (SecuritySystemCurrentState == 4) {
                if (!node.timer && !node.hasAlarmed) {
                    node.counter = node.delay;
                    if (node.counter > 0) {
                        node.timer = setTimeout(emitAlarm(msg), 1000);
                        node.status({
                            fill: "grey",
                            shape: "dot",
                            text: "" + node.counter
                        });
                    } else {
                        emitAlarm(msg)();
                    }
                }
            } else {
                //
                // alarm is cleared if the mode changes
                //
                clearAlarm();
            }

        });

        /**
         * clean up on node removal
         */
        node.on('close', function() {
            node._panel && node._panel.deregisterStateListener(node);
            if (node.timer) {
                clearTimeout(node.timer);
                node.timer = null;
            }
        });

    }
    RED.nodes.registerType("AnamicoAlarmTriggered", AnamicoAlarmTriggered);
};
