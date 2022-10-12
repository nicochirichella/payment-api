const expect = require('chai').expect;
const CybersourceResponseHandler = require('../../src/services/cybersource_response_handler');

describe('Cybersource Response Handler', () => {

  describe('#Constructor', () => {

    it('should add initially set authorization and decision manager as null', () => {
      const crh = new CybersourceResponseHandler();
      expect(crh.authorization).to.eql(null);
      expect(crh.decisionManager).to.eql(null);
    });

  describe('methods', () => {

    let crh;
    beforeEach(() => {
      crh = new CybersourceResponseHandler();
    });

    describe('#setDecisionManager', () => {

      it('should set whatever is passed as parameter', () => {
        const dummyResponse = { decision: 'ACCEPT' };
        crh.setDecisionManager(dummyResponse);
        expect(crh.decisionManager).to.eql(dummyResponse);
      });

      it('should throw an error if passed null', () => {
        const dummyResponse = null;
        expect(() => crh.setDecisionManager(dummyResponse)).to.throw('Trying to set null dm response');
      });
    });

    describe('#setAuthorization', () => {

      it('should set whatever is passed as parameter', () => {
        const dummyResponse = { decision: 'ACCEPT' };
        crh.setAuthorization(dummyResponse);
        expect(crh.authorization).to.eql(dummyResponse);
      });

      it('should throw an error if passed null', () => {
        const dummyResponse = null;
        expect(() => crh.setAuthorization(dummyResponse)).to.throw('Trying to set null auth response');
      });
    });

    describe('#getDecisionManagerDecision', () => {

      it('should return the decision of the decision manager response', () => {
        const dummyResponse = { decision: 'ACCEPT' };
        crh.setDecisionManager(dummyResponse);
        expect(crh.getDecisionManagerDecision()).to.eql('ACCEPT');
      });

      it('should return null if the decision manager was never set in the first place', () => {
        expect(crh.getDecisionManagerDecision()).to.eql(null);
      });
    });

    describe('#getAuthorizationDecision', () => {

      it('should return the decision of the authorization response', () => {
        const dummyResponse = { decision: 'ACCEPT' };
        crh.setAuthorization(dummyResponse);
        expect(crh.getAuthorizationDecision()).to.eql('ACCEPT');
      });

      it('should return null if the authorization was never set in the first place', () => {
        expect(crh.getAuthorizationDecision()).to.eql(null);
      });
    });


    describe('#dmPassed', () => {

      it('should return true if the dm decision was REVIEW', () => {
        const dummyResponse = { decision: 'REVIEW' };
        crh.setDecisionManager(dummyResponse);
        expect(crh.dmPassed()).to.eql(true);
      });

      it('should return true if the dm decision was ACCEPT', () => {
        const dummyResponse = { decision: 'ACCEPT' };
        crh.setDecisionManager(dummyResponse);
        expect(crh.dmPassed()).to.eql(true);
      });

      it('should return false if the dm decision was REJECT', () => {
        const dummyResponse = { decision: 'REJECT' };
        crh.setDecisionManager(dummyResponse);
        expect(crh.dmPassed()).to.eql(false);
      });

      it('should return true if the dm decision was ERROR', () => {
        const dummyResponse = { decision: 'ERROR' };
        crh.setDecisionManager(dummyResponse);
        expect(crh.dmPassed()).to.eql(false);
      });

      it('should return false if the dm is null (was never made)', () => {
        expect(crh.dmPassed()).to.eql(false);
      });
    });


    describe('#dmReviewedButAuthRejected', () => {

      it('should return true if the dm decision was REVIEW and auth was REJECTED', () => {
        const dmDummyResponse = { decision: 'REVIEW' };
        const authDummyResponse = { decision: 'REJECT' };
        crh.setDecisionManager(dmDummyResponse);
        crh.setAuthorization(authDummyResponse);
        expect(crh.dmReviewedButAuthRejected()).to.eql(true);
      });

      it('should return false if the dm decision was ACCEPT and auth was REJECTED', () => {
        const dmDummyResponse = { decision: 'ACCEPT' };
        const authDummyResponse = { decision: 'REJECT' };
        crh.setDecisionManager(dmDummyResponse);
        crh.setAuthorization(authDummyResponse);
        expect(crh.dmReviewedButAuthRejected()).to.eql(false);
      });

      it('should return false if the dm decision was REJECT and auth was not made at all', () => {
        const dmDummyResponse = { decision: 'REJECT' };
        crh.setDecisionManager(dmDummyResponse);
        expect(crh.dmReviewedButAuthRejected()).to.eql(false);
      });

    });

  });

  })
})
;

