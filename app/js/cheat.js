skidinc.cheat = {};

skidinc.cheat.codes = {
    rich: {
        desc: 'add $1,000,000.',
        exec: function() {
            skidinc.player.earn('money', 1000000);
            return skidinc.console.print('Cheat applied: +$1,000,000.');
        }
    },
    xp: {
        desc: 'add 25,000 exp.',
        exec: function() {
            skidinc.player.earn('exp', 25000);
            return skidinc.console.print('Cheat applied: +25,000 exp.');
        }
    },
    multiplier: {
        desc: 'increase multiplier level by 1 (free).',
        exec: function() {
            skidinc.player.multiplierLevel++;
            return skidinc.console.print('Cheat applied: multiplier level is now <b>' + skidinc.player.multiplierLevel + '</b>.');
        }
    },
    unlockscripts: {
        desc: 'unlock all scripts.',
        exec: function() {
            skidinc.script.unlocked = skidinc.script.scripts.map(function() {
                return true;
            });
            return skidinc.console.print('Cheat applied: all scripts unlocked.');
        }
    },
    unlockautoscripts: {
        desc: 'unlock all autoscripts.',
        exec: function() {
            skidinc.autoscript.unlocked = skidinc.script.scripts.map(function() {
                return true;
            });
            return skidinc.console.print('Cheat applied: all autoscripts unlocked.');
        }
    }
};

skidinc.cheat.list = function() {
    var str = '<y>CHEAT LIST</y>:<br>';

    Object.keys(skidinc.cheat.codes).forEach(function(code) {
        str += '<b>-</b> <z>' + code + '</z>: ' + skidinc.cheat.codes[code].desc + '<br>';
    });

    return skidinc.console.print(str);
};

skidinc.cheat.help = function() {
    var str = '<y>CHEAT HELP</y> use cheat codes to quickly modify your game state:<br>' +
        '<b>-</b> use <b>cheat -l</b> to list codes.<br>' +
        '<b>-</b> example: <b>cheat rich</b>.';

    return skidinc.console.print(str);
};

skidinc.cheat.execute = function(args) {
    var code = args[0],
        entry = skidinc.cheat.codes[code];

    if (!entry)
        return skidinc.console.print('<x>ERR</x> <b>' + code + '</b> is not a known cheat code.');

    return entry.exec();
};
