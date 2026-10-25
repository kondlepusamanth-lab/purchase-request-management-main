const cds = require('@sap/cds');

const {
    SELECT,
    INSERT,
    UPDATE,
    DELETE
} = cds.ql;


module.exports = class PurchaseService extends cds.ApplicationService {

    async init() {

        const {
            PurchaseRequests,
            PurchaseRequestItems,
            StatusHistories,
            Notifications,
            Attachments,
            NumberRanges
        } = cds.entities('purchase');


        /* =====================================================
           CONSTANTS
           ===================================================== */

        const VALID_DEPARTMENTS = [
            'Finance',
            'HR',
            'Procurement',
            'IT',
            'Manufacturing'
        ];

        const TAX_PERCENT = 18;

        const MAX_ITEMS = 20;

        const MIN_AMOUNT = 100;


        /* =====================================================
           APPROVAL MATRIX
           ===================================================== */

        function getApproverLevel(amount) {

            if (amount <= 10000) {
                return 'Manager';
            }

            if (amount <= 50000) {
                return 'Senior Manager';
            }

            return 'Director';
        }


        /* =====================================================
           REQUEST NUMBER GENERATION
           ===================================================== */

        async function generateRequestNumber(tx) {

            const year = new Date().getFullYear();

            let range = await tx.run(
                SELECT.one
                    .from(NumberRanges)
                    .where({ year })
            );

            if (!range) {

                await tx.run(
                    INSERT.into(NumberRanges).entries({
                        year: year,
                        lastNumber: 1
                    })
                );

                return `PR-${year}-000001`;
            }

            const nextNumber = range.lastNumber + 1;

            await tx.run(
                UPDATE(NumberRanges)
                    .set({
                        lastNumber: nextNumber
                    })
                    .where({
                        year: year
                    })
            );

            return `PR-${year}-${String(nextNumber).padStart(6, '0')}`;
        }


        /* =====================================================
           DATE VALIDATION
           ===================================================== */

        function validateRequestDate(date) {

            if (!date) {
                return 'Request Date is mandatory.';
            }

            const requestDate = new Date(date);

            const today = new Date();

            today.setHours(0, 0, 0, 0);

            requestDate.setHours(0, 0, 0, 0);

            if (requestDate > today) {
                return 'Request Date cannot be a future date.';
            }

            const minimumDate = new Date(today);

            minimumDate.setDate(
                minimumDate.getDate() - 30
            );

            if (requestDate < minimumDate) {
                return 'Request Date cannot be more than 30 days old.';
            }

            return null;
        }


        /* =====================================================
           ITEM CALCULATION
           ===================================================== */

        function calculateItem(item) {

            const quantity = Number(item.quantity);

            const unitPrice = Number(item.unitPrice);

            const netAmount =
                quantity * unitPrice;

            const taxAmount =
                netAmount * TAX_PERCENT / 100;

            const grossAmount =
                netAmount + taxAmount;

            return {
                netAmount:
                    Number(netAmount.toFixed(2)),

                taxPercent:
                    TAX_PERCENT,

                taxAmount:
                    Number(taxAmount.toFixed(2)),

                grossAmount:
                    Number(grossAmount.toFixed(2)),

                totalPrice:
                    Number(grossAmount.toFixed(2))
            };
        }


        /* =====================================================
           CREATE PURCHASE REQUEST
           ===================================================== */

        this.before('CREATE', PurchaseRequests, async req => {

            /* Request Number must not come from user */

            delete req.data.purchaseRequestNumber;

            req.data.status = 'Draft';

            if (!req.data.currency) {
                req.data.currency = 'INR';
            }


            /* Department validation */

            if (
                req.data.department &&
                !VALID_DEPARTMENTS.includes(
                    req.data.department
                )
            ) {
                req.error(
                    400,
                    `Invalid Department. Valid departments are: ${VALID_DEPARTMENTS.join(', ')}`
                );
            }


            /* Date validation */

            const dateError =
                validateRequestDate(
                    req.data.requestDate
                );

            if (dateError) {
                req.error(400, dateError);
            }


            /* Generate PR number */

            req.data.purchaseRequestNumber =
                await generateRequestNumber(
                    cds.tx(req)
                );
        });


        /* =====================================================
           CREATE ITEM
           ===================================================== */

        this.before(
            'CREATE',
            PurchaseRequestItems,
            async req => {

                const quantity =
                    Number(req.data.quantity);

                const unitPrice =
                    Number(req.data.unitPrice);


                /* Quantity > 0 */

                if (quantity <= 0) {
                    req.error(
                        400,
                        'Quantity must be greater than zero.'
                    );
                }


                /* Quantity <= 100 */

                if (quantity > 100) {
                    req.error(
                        400,
                        'Quantity cannot exceed 100.'
                    );
                }


                /* Unit Price */

                if (unitPrice <= 0) {
                    req.error(
                        400,
                        'Unit Price must be greater than zero.'
                    );
                }


                if (unitPrice >= 100000) {
                    req.error(
                        400,
                        'Unit Price must be less than ₹1,00,000.'
                    );
                }


                /* Description */

                if (
                    !req.data.description ||
                    req.data.description.trim().length < 10
                ) {
                    req.error(
                        400,
                        'Material Description is mandatory and must contain at least 10 characters.'
                    );
                }


                /* Calculate amounts */

                const calculated =
                    calculateItem(req.data);

                Object.assign(
                    req.data,
                    calculated
                );


                /* =================================================
                   CHECK PARENT REQUEST
                   ================================================= */

                const request =
                    await cds.tx(req).run(
                        SELECT.one
                            .from(PurchaseRequests)
                            .where({
                                ID:
                                    req.data
                                        .purchaseRequest_ID
                            })
                    );


                if (!request) {
                    req.error(
                        404,
                        'Purchase Request not found.'
                    );
                }


                /* Only Draft can be changed */

                if (request.status !== 'Draft') {
                    req.error(
                        400,
                        'Only Draft Purchase Requests can be modified.'
                    );
                }


                /* Maximum 20 items */

                const count =
                    await cds.tx(req).run(
                        SELECT.one
                            .from(PurchaseRequestItems)
                            .columns('ID')
                            .where({
                                purchaseRequest_ID:
                                    request.ID
                            })
                            .limit(20)
                    );

                const existingItems =
                    await cds.tx(req).run(
                        SELECT.from(
                            PurchaseRequestItems
                        ).where({
                            purchaseRequest_ID:
                                request.ID
                        })
                    );

                if (existingItems.length >= MAX_ITEMS) {
                    req.error(
                        400,
                        'A Purchase Request can contain a maximum of 20 items.'
                    );
                }


                /* Duplicate Material Number */

                const duplicate =
                    existingItems.find(
                        item =>
                            item.materialNumber ===
                            req.data.materialNumber
                    );

                if (duplicate) {
                    req.error(
                        400,
                        `Duplicate Material Number ${req.data.materialNumber} is not allowed.`
                    );
                }
            }
        );


        /* =====================================================
           UPDATE ITEM
           ===================================================== */

        this.before(
            'UPDATE',
            PurchaseRequestItems,
            async req => {

                const item =
                    await cds.tx(req).run(
                        SELECT.one
                            .from(PurchaseRequestItems)
                            .where({
                                ID: req.data.ID
                            })
                    );

                if (!item) {
                    req.error(
                        404,
                        'Purchase Request Item not found.'
                    );
                }


                const request =
                    await cds.tx(req).run(
                        SELECT.one
                            .from(PurchaseRequests)
                            .where({
                                ID:
                                    item.purchaseRequest_ID
                            })
                    );


                if (request.status !== 'Draft') {
                    req.error(
                        400,
                        'Only Draft Purchase Requests can be modified.'
                    );
                }


                const quantity =
                    req.data.quantity ??
                    item.quantity;

                const unitPrice =
                    req.data.unitPrice ??
                    item.unitPrice;


                if (quantity <= 0) {
                    req.error(
                        400,
                        'Quantity must be greater than zero.'
                    );
                }


                if (quantity > 100) {
                    req.error(
                        400,
                        'Quantity cannot exceed 100.'
                    );
                }


                if (unitPrice <= 0) {
                    req.error(
                        400,
                        'Unit Price must be greater than zero.'
                    );
                }


                if (unitPrice >= 100000) {
                    req.error(
                        400,
                        'Unit Price must be less than ₹1,00,000.'
                    );
                }


                const description =
                    req.data.description ??
                    item.description;

                if (
                    !description ||
                    description.trim().length < 10
                ) {
                    req.error(
                        400,
                        'Material Description must contain at least 10 characters.'
                    );
                }


                /* Recalculate */

                Object.assign(
                    req.data,
                    calculateItem({
                        quantity,
                        unitPrice
                    })
                );
            }
        );


        /* =====================================================
           DELETE ITEM
           ===================================================== */

        this.before(
            'DELETE',
            PurchaseRequestItems,
            async req => {

                const item =
                    await cds.tx(req).run(
                        SELECT.one
                            .from(PurchaseRequestItems)
                            .where({
                                ID: req.data.ID
                            })
                    );

                if (!item) {
                    req.error(
                        404,
                        'Purchase Request Item not found.'
                    );
                }


                const request =
                    await cds.tx(req).run(
                        SELECT.one
                            .from(PurchaseRequests)
                            .where({
                                ID:
                                    item.purchaseRequest_ID
                            })
                    );


                if (request.status !== 'Draft') {
                    req.error(
                        400,
                        'Items cannot be deleted after request submission.'
                    );
                }
            }
        );


        /* =====================================================
           UPDATE PURCHASE REQUEST
           ===================================================== */

        this.before(
            'UPDATE',
            PurchaseRequests,
            async req => {

                const request =
                    await cds.tx(req).run(
                        SELECT.one
                            .from(PurchaseRequests)
                            .where({
                                ID: req.data.ID
                            })
                    );

                if (!request) {
                    req.error(
                        404,
                        'Purchase Request not found.'
                    );
                }


                const lockedStatuses = [
                    'Approved',
                    'Rejected',
                    'Cancelled',
                    'Expired'
                ];


                if (
                    lockedStatuses.includes(
                        request.status
                    )
                ) {
                    req.error(
                        400,
                        `Purchase Request is ${request.status}. Modifications are not allowed.`
                    );
                }
            }
        );


        /* =====================================================
           SUBMIT REQUEST
           ===================================================== */

        this.on(
            'submitRequest',
            async req => {

                const tx = cds.tx(req);

                const request =
                    await tx.run(
                        SELECT.one
                            .from(PurchaseRequests)
                            .where({
                                ID:
                                    req.data.ID
                            })
                    );


                if (!request) {
                    return req.error(
                        404,
                        'Purchase Request not found.'
                    );
                }


                if (request.status !== 'Draft') {
                    return req.error(
                        400,
                        'Only Draft requests can be submitted.'
                    );
                }


                /* At least one item */

                const items =
                    await tx.run(
                        SELECT.from(
                            PurchaseRequestItems
                        ).where({
                            purchaseRequest_ID:
                                request.ID
                        })
                    );


                if (items.length === 0) {
                    return req.error(
                        400,
                        'Cannot submit Purchase Request. At least one item is required.'
                    );
                }


                /* Recalculate total */

                const total =
                    items.reduce(
                        (sum, item) =>
                            sum +
                            Number(
                                item.grossAmount || 0
                            ),
                        0
                    );


                if (total <= MIN_AMOUNT) {
                    return req.error(
                        400,
                        'Purchase Request Total Amount must be greater than ₹100.'
                    );
                }


                /* Approver matrix */

                const approverLevel =
                    getApproverLevel(total);


                if (total > 50000) {

                    if (!request.approver) {
                        return req.error(
                            400,
                            'Amount exceeds ₹50,000. An Approver must be assigned.'
                        );
                    }
                }


                /* Attachment requirement */

                if (total > 100000) {

                    const attachments =
                        await tx.run(
                            SELECT.from(
                                Attachments
                            ).where({
                                purchaseRequest_ID:
                                    request.ID
                            })
                        );


                    if (
                        attachments.length === 0
                    ) {
                        return req.error(
                            400,
                            'Supporting document is mandatory when Total Amount exceeds ₹1,00,000.'
                        );
                    }
                }


                await tx.run(
                    UPDATE(PurchaseRequests)
                        .set({
                            totalAmount: total,
                            approverLevel:
                                approverLevel,
                            status: 'Submitted'
                        })
                        .where({
                            ID: request.ID,
                            status: 'Draft'
                        })
                );


                /* History */

                await tx.run(
                    INSERT.into(
                        StatusHistories
                    ).entries({
                        requestNumber:
                            request.purchaseRequestNumber,

                        oldStatus: 'Draft',

                        newStatus: 'Submitted',

                        user:
                            req.user?.id ||
                            'system',

                        timestamp:
                            new Date(),

                        purchaseRequest_ID:
                            request.ID
                    })
                );


                /* Notification */

                await tx.run(
                    INSERT.into(
                        Notifications
                    ).entries({
                        requestNumber:
                            request.purchaseRequestNumber,

                        notificationType:
                            'SUBMITTED',

                        message:
                            `Purchase Request ${request.purchaseRequestNumber} has been submitted.`,

                        recipient:
                            request.approver ||
                            'Approver',

                        isRead: false,

                        purchaseRequest_ID:
                            request.ID
                    })
                );


                return {
                    message:
                        'Purchase Request submitted successfully.'
                };
            }
        );


        /* =====================================================
           APPROVE REQUEST
           ===================================================== */

        this.on(
            'approveRequest',
            async req => {

                const tx = cds.tx(req);

                const request =
                    await tx.run(
                        SELECT.one
                            .from(PurchaseRequests)
                            .where({
                                ID:
                                    req.data.ID
                            })
                    );


                if (!request) {
                    return req.error(
                        404,
                        'Purchase Request not found.'
                    );
                }


                if (request.status !== 'Submitted') {
                    return req.error(
                        400,
                        'Purchase Request already processed by another user.'
                    );
                }


                const user =
                    req.user?.id ||
                    'system';


                /* Concurrent approval protection */

                const affected =
                    await tx.run(
                        UPDATE(PurchaseRequests)
                            .set({
                                status: 'Approved',

                                approvalComments:
                                    req.data.comments ||
                                    null,

                                approvedBy: user,

                                approvedAt:
                                    new Date()
                            })
                            .where({
                                ID: request.ID,

                                status: 'Submitted'
                            })
                    );


                if (affected !== 1) {
                    return req.error(
                        409,
                        'Purchase Request already processed by another user.'
                    );
                }


                /* History */

                await tx.run(
                    INSERT.into(
                        StatusHistories
                    ).entries({
                        requestNumber:
                            request.purchaseRequestNumber,

                        oldStatus:
                            'Submitted',

                        newStatus:
                            'Approved',

                        user: user,

                        timestamp:
                            new Date(),

                        purchaseRequest_ID:
                            request.ID
                    })
                );


                /* Notification */

                await tx.run(
                    INSERT.into(
                        Notifications
                    ).entries({
                        requestNumber:
                            request.purchaseRequestNumber,

                        notificationType:
                            'APPROVED',

                        message:
                            `Purchase Request ${request.purchaseRequestNumber} has been approved.`,

                        recipient:
                            request.requesterName,

                        isRead: false,

                        purchaseRequest_ID:
                            request.ID
                    })
                );


                return {
                    message:
                        'Purchase Request approved successfully.'
                };
            }
        );


        /* =====================================================
           REJECT REQUEST
           ===================================================== */

        this.on(
            'rejectRequest',
            async req => {

                const comments =
                    req.data.comments || '';


                if (comments.trim().length < 20) {
                    return req.error(
                        400,
                        'Rejection comments are mandatory and must contain at least 20 characters.'
                    );
                }


                const tx = cds.tx(req);


                const request =
                    await tx.run(
                        SELECT.one
                            .from(PurchaseRequests)
                            .where({
                                ID:
                                    req.data.ID
                            })
                    );


                if (!request) {
                    return req.error(
                        404,
                        'Purchase Request not found.'
                    );
                }


                if (request.status !== 'Submitted') {
                    return req.error(
                        400,
                        'Purchase Request already processed by another user.'
                    );
                }


                const user =
                    req.user?.id ||
                    'system';


                const affected =
                    await tx.run(
                        UPDATE(PurchaseRequests)
                            .set({

                                status:
                                    'Rejected',

                                rejectionComments:
                                    comments,

                                rejectedBy:
                                    user,

                                rejectedAt:
                                    new Date()

                            })
                            .where({
                                ID:
                                    request.ID,

                                status:
                                    'Submitted'
                            })
                    );


                if (affected !== 1) {
                    return req.error(
                        409,
                        'Purchase Request already processed by another user.'
                    );
                }


                /* History */

                await tx.run(
                    INSERT.into(
                        StatusHistories
                    ).entries({

                        requestNumber:
                            request.purchaseRequestNumber,

                        oldStatus:
                            'Submitted',

                        newStatus:
                            'Rejected',

                        user:
                            user,

                        timestamp:
                            new Date(),

                        purchaseRequest_ID:
                            request.ID
                    })
                );


                /* Notification */

                await tx.run(
                    INSERT.into(
                        Notifications
                    ).entries({

                        requestNumber:
                            request.purchaseRequestNumber,

                        notificationType:
                            'REJECTED',

                        message:
                            `Purchase Request ${request.purchaseRequestNumber} has been rejected.`,

                        recipient:
                            request.requesterName,

                        isRead:
                            false,

                        purchaseRequest_ID:
                            request.ID
                    })
                );


                return {
                    message:
                        'Purchase Request rejected successfully.'
                };
            }
        );


        /* =====================================================
           CANCEL REQUEST
           ===================================================== */

        this.on(
            'cancelRequest',
            async req => {

                const tx = cds.tx(req);


                const request =
                    await tx.run(
                        SELECT.one
                            .from(PurchaseRequests)
                            .where({
                                ID:
                                    req.data.ID
                            })
                    );


                if (!request) {
                    return req.error(
                        404,
                        'Purchase Request not found.'
                    );
                }


                if (
                    request.status !== 'Draft' &&
                    request.status !== 'Submitted'
                ) {
                    return req.error(
                        400,
                        'Only Draft and Submitted requests can be cancelled.'
                    );
                }


                const oldStatus =
                    request.status;


                await tx.run(
                    UPDATE(PurchaseRequests)
                        .set({
                            status:
                                'Cancelled',

                            cancelledComments:
                                req.data.comments ||
                                null
                        })
                        .where({
                            ID:
                                request.ID
                        })
                );


                /* History */

                await tx.run(
                    INSERT.into(
                        StatusHistories
                    ).entries({

                        requestNumber:
                            request.purchaseRequestNumber,

                        oldStatus:
                            oldStatus,

                        newStatus:
                            'Cancelled',

                        user:
                            req.user?.id ||
                            'system',

                        timestamp:
                            new Date(),

                        purchaseRequest_ID:
                            request.ID
                    })
                );


                /* Notification */

                await tx.run(
                    INSERT.into(
                        Notifications
                    ).entries({

                        requestNumber:
                            request.purchaseRequestNumber,

                        notificationType:
                            'CANCELLED',

                        message:
                            `Purchase Request ${request.purchaseRequestNumber} has been cancelled.`,

                        recipient:
                            request.requesterName,

                        isRead:
                            false,

                        purchaseRequest_ID:
                            request.ID
                    })
                );


                return {
                    message:
                        'Purchase Request cancelled successfully.'
                };
            }
        );


        /* =====================================================
           ITEM DELETE RESTRICTION
           ===================================================== */

        this.before(
            'DELETE',
            PurchaseRequestItems,
            async req => {

                const item =
                    await cds.tx(req).run(
                        SELECT.one
                            .from(PurchaseRequestItems)
                            .where({
                                ID:
                                    req.data.ID
                            })
                    );


                if (!item) {
                    return req.error(
                        404,
                        'Item not found.'
                    );
                }


                const request =
                    await cds.tx(req).run(
                        SELECT.one
                            .from(PurchaseRequests)
                            .where({
                                ID:
                                    item.purchaseRequest_ID
                            })
                    );


                if (request.status !== 'Draft') {
                    return req.error(
                        400,
                        'Item cannot be deleted after request submission.'
                    );
                }
            }
        );


        /* =====================================================
           ATTACHMENT VALIDATION
           ===================================================== */

        this.before(
            'CREATE',
            Attachments,
            async req => {

                const allowedTypes = [
                    'application/pdf',
                    'image/jpeg',
                    'image/png'
                ];


                if (
                    !allowedTypes.includes(
                        req.data.mediaType
                    )
                ) {
                    req.error(
                        400,
                        'Only PDF, JPG and PNG files are allowed.'
                    );
                }


                const maxSize =
                    10 * 1024 * 1024;


                if (
                    req.data.fileSize > maxSize
                ) {
                    req.error(
                        400,
                        'Attachment size cannot exceed 10 MB.'
                    );
                }
            }
        );


        /* =====================================================
           DRAFT EXPIRY
           ===================================================== */

        setInterval(
            async () => {

                try {

                    const tx =
                        cds.tx();

                    const expiryDate =
                        new Date();

                    expiryDate.setDate(
                        expiryDate.getDate() - 30
                    );


                    await tx.run(
                        UPDATE(PurchaseRequests)
                            .set({
                                status:
                                    'Expired'
                            })
                            .where({
                                status:
                                    'Draft',

                                createdAt: {
                                    '<':
                                    expiryDate
                                }
                            })
                    );

                } catch (error) {

                    console.error(
                        'Draft expiry job error:',
                        error
                    );
                }

            },

            24 * 60 * 60 * 1000
        );


        return super.init();
    }
};