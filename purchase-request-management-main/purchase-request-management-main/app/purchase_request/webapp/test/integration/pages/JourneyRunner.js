sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"purchaserequest/test/integration/pages/PurchaseRequestsList.gen",
	"purchaserequest/test/integration/pages/PurchaseRequestsObjectPage.gen"
], function (JourneyRunner, PurchaseRequestsListGenerated, PurchaseRequestsObjectPageGenerated) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('purchaserequest') + '/test/flp.html#app-preview',
        pages: {
			onThePurchaseRequestsListGenerated: PurchaseRequestsListGenerated,
			onThePurchaseRequestsObjectPageGenerated: PurchaseRequestsObjectPageGenerated
        },
        async: true
    });

    return runner;
});

