skidinc.player = {};
skidinc.player.username = 'kiddie';

skidinc.player.money = 0;
skidinc.player.totalMoney = 0;
skidinc.player.exp = 0;
skidinc.player.totalExp = 0;
skidinc.player.expReq = 100;
skidinc.player.level = 1;
skidinc.player.botnet = 0;
skidinc.player.multiplierLevel = 0;

skidinc.player.getTimeMult = function() {
    return skidinc.server.getEffects('telnet').time * skidinc.battery.getTimeEffect() * skidinc.player.getMultiplierBoost();
};

skidinc.player.getMultiplierBoost = function() {
    return 1 + (skidinc.player.multiplierLevel * 0.05);
};

skidinc.player.getMoneyMult = function(display) {
    if (display)
        return skidinc.server.getEffects('web').money * skidinc.battery.getMoneyEffect() * skidinc.player.getMultiplierBoost();
    
    return (skidinc.server.getEffects('web').money * skidinc.battery.getMoneyEffect() * skidinc.player.getMultiplierBoost()) * skidinc.prestige.getPrestigeMult();
};

skidinc.player.getExpMult = function(display) {
    if (display)
        return skidinc.server.getEffects('web').exp * skidinc.battery.getExpEffect() * skidinc.player.getMultiplierBoost();
    
    return (skidinc.server.getEffects('web').exp * skidinc.battery.getExpEffect() * skidinc.player.getMultiplierBoost()) * skidinc.prestige.getPrestigeMult();
};

skidinc.player.getMultiplierCost = function() {
    return Math.floor(50000 * Math.pow(2.4, skidinc.player.multiplierLevel));
};

skidinc.player.listMultiplier = function() {
    return '<b>*</b> level <b>' + skidinc.player.multiplierLevel + '</b>, boost <b>x' + fix(skidinc.player.getMultiplierBoost(), 2) + '</b>, next upgrade cost <b>$' + fix(skidinc.player.getMultiplierCost(), 0) + '</b>.';
};

skidinc.player.buyMultiplier = function() {
    var cost = skidinc.player.getMultiplierCost();

    if (skidinc.player.money < cost)
        return skidinc.console.print('<x>ERR</x> not enough money to buy multiplier upgrade (cost <b>$' + fix(cost, 0) + '</b>).');

    skidinc.player.money -= cost;
    skidinc.player.multiplierLevel++;

    return skidinc.console.print('Multiplier upgraded to <b>lvl ' + skidinc.player.multiplierLevel + '</b> (boost x' + fix(skidinc.player.getMultiplierBoost(), 2) + ').');
};

skidinc.player.setUsernamePrefix = function() {
    $('body').append('<p id="username-width" style="display: none; font-size: 26px;">' + skidinc.player.username + '</p>');

    var usernameWidth = Math.floor($('#username-width').width());

    $('#username-width').remove();
    $('#input-session').html(skidinc.player.username);
    $('#command-input').css('width', 'calc(100% - 25px - 115px - ' + usernameWidth + 'px)');
};

skidinc.player.setUsername = function(args) {
    if (skidinc.tutorial.step == 0 && !skidinc.tutorial.finish) {
        if (args[0].length < 1)
            return skidinc.console.print('<x>ERR</x> put a valid username.');
        
        if (args[0].length > 12)
            return skidinc.console.print('<x>ERR</x> <b>' + args[0] + '</b> is too long (> 12 char).');
        
        $('body').append('<p id="username-width" style="display: none; font-size: 26px;">' + args[0] + '</p>');
        
        var usernameWidth = Math.floor($('#username-width').width());
        
        skidinc.player.username = args[0];
        
        $('#username-width').remove();
        $('#input-session').html(args[0]);
        $('#command-input').css('width', 'calc(100% - 25px - 115px - ' + usernameWidth + 'px)');
        
        skidinc.console.print('Your new username is now <b>' + args[0] + '</b>.', function() {
            if (skidinc.tutorial.enabled)
                skidinc.tutorial.switchStep(1);
        });
    };
};

skidinc.player.earn = function(type, amount) {
    if (type == 'money') {
        skidinc.player.money += amount;
        skidinc.player.totalMoney += amount;
    };
    
    if (type == 'exp') {
        skidinc.player.exp += amount;
        skidinc.player.totalExp += amount;
        
        while (skidinc.player.exp >= skidinc.player.expReq) {
            skidinc.player.level++;
            skidinc.player.exp -= skidinc.player.expReq;
            skidinc.player.expReq = Math.floor(100 * Math.pow(1.5, skidinc.player.level));
            skidinc.console.print('<z>LEVEL-UP!</z> You are now level <b>' + skidinc.player.level + '</b>!');
        };
    };
};

skidinc.player.prestige = function() {
    skidinc.before = new Date().getTime();
    skidinc.now = new Date().getTime();
    
    skidinc.player.money = 0;
    skidinc.player.expReq = 100;
    skidinc.player.exp = 0;
    skidinc.player.level = 1;
    skidinc.player.multiplierLevel = 0;
};
